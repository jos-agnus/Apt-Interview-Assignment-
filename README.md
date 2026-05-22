# Orders — Realtime Update System

A backend service that watches a PostgreSQL `orders` table and pushes every insert, update, or delete to connected browser clients in real time.

---

## How it works

```
PostgreSQL trigger
      │  pg_notify('orders_channel', payload)
      ▼
Node.js LISTEN client
      │  parses JSON payload
      ▼
Socket.IO broadcast
      │  io.emit('order_update', { op, data })
      ▼
Browser client
      │  updates table + appends to event log
```

### Why this approach

**PostgreSQL LISTEN/NOTIFY** was chosen over polling or a message queue because:

- It is built into Postgres — no extra infrastructure (no Kafka, no Redis).
- Notifications fire inside the transaction that made the change, so clients never see a stale snapshot.
- The payload is JSON, so no extra parsing step is needed between the DB and the backend.
- A single dedicated `LISTEN` client scales to thousands of Socket.IO subscribers; the fan-out happens in Node, not in the database.

For horizontal scaling (multiple Node instances), the `LISTEN` client on each instance can subscribe independently — Postgres broadcasts to all of them — so no sticky sessions are needed.

---

## Project structure

```
orders-realtime/
├── backend/
│   ├── server.js        # Express + Socket.IO + pg LISTEN
│   ├── schema.sql       # Table, trigger function, seed data
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── client/
│   └── index.html       # Single-file browser client
├── docker-compose.yml
└── README.md
```

---

## Running with Docker (recommended)

```bash
git clone <repo>
cd orders-realtime

docker compose up --build
```

- Backend:  http://localhost:3000
- Open `client/index.html` directly in your browser (no server needed — it's a static file).

---

## Running locally (without Docker)

### 1. Postgres

```bash
# macOS
brew install postgresql@16 && brew services start postgresql@16

# Ubuntu
sudo apt install postgresql && sudo systemctl start postgresql
```

```bash
createdb ordersdb
psql ordersdb < backend/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # edit DB_* values if needed
npm install
npm start
```

### 3. Client

Just open `client/index.html` in your browser.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/orders | List all orders |
| POST | /api/orders | Create an order |
| PATCH | /api/orders/:id | Update status |
| DELETE | /api/orders/:id | Delete an order |

### Example — create an order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Aryan","product_name":"USB Hub","status":"pending"}'
```

### Example — update status

```bash
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"shipped"}'
```

Every curl command above will trigger a real-time update in any open browser tab.

---

## Testing real-time updates

1. Open `client/index.html` in two browser tabs.
2. Use the "Add order" form in one tab — both tabs update instantly.
3. Or run a curl command — both tabs update within milliseconds.
4. The event log on the right shows every INSERT / UPDATE / DELETE with a timestamp.

---

## Design decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Language | Node.js | Non-blocking I/O fits long-lived WebSocket connections well |
| Database | PostgreSQL | Native LISTEN/NOTIFY eliminates the need for a separate message broker |
| Realtime | Socket.IO | Handles WebSocket + long-poll fallback, works everywhere |
| Client | Plain HTML/JS | No build step; easy to inspect and run |
| Change detection | DB trigger | Changes made by any client (SQL console, migrations, other services) are captured — not just API calls |
