require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const { Pool, Client } = require('pg');

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'ordersdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
};

// ─── Express + Socket.IO setup ───────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ─── Postgres connection pool (for REST endpoints) ───────────────────────────

const pool = new Pool(dbConfig);

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[REST] Error fetching orders:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST create order
app.post('/api/orders', async (req, res) => {
  const { customer_name, product_name, status = 'pending' } = req.body;

  if (!customer_name || !product_name) {
    return res.status(400).json({ error: 'customer_name and product_name are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_name, product_name, status, updated_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [customer_name, product_name, status]
    );
    // Trigger fires automatically → pg_notify → Socket.IO push happens in listener
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[REST] Error creating order:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH update order status
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ['pending', 'shipped', 'delivered'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[REST] Error updating order:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ deleted: true, order: rows[0] });
  } catch (err) {
    console.error('[REST] Error deleting order:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── PostgreSQL LISTEN client ─────────────────────────────────────────────────
// A dedicated long-lived client is required for LISTEN/NOTIFY.
// The pool recycles connections, so we use a standalone Client here.

async function startListening() {
  const listener = new Client(dbConfig);

  try {
    await listener.connect();
    await listener.query('LISTEN orders_channel');
    console.log('[DB] Listening on orders_channel');

    listener.on('notification', (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        console.log(`[DB] Notification received: ${payload.op} on order #${payload.data?.id}`);

        // Broadcast to every connected Socket.IO client
        io.emit('order_update', payload);
      } catch (e) {
        console.error('[DB] Failed to parse notification payload:', e.message);
      }
    });

    listener.on('error', (err) => {
      console.error('[DB] Listener error:', err.message);
      // Reconnect after a short delay
      setTimeout(startListening, 5000);
    });

  } catch (err) {
    console.error('[DB] Could not connect listener:', err.message);
    setTimeout(startListening, 5000);
  }
}

// ─── Socket.IO connection handler ────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

server.listen(PORT, async () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  await startListening();
});
