const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const orderRoutes = require('./routes/orders');
const { login } = require('./auth');
require('dotenv').config();

const client = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/orders', orderRoutes);
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.get('/', (req, res) => {
    res.send('Realtime Order Notification System Running');
});

/*
========================================
LOGIN ROUTE
========================================
*/

app.post('/login', login);

/*
========================================
SOCKET.IO CONNECTION
========================================
*/

io.on('connection', (socket) => {

    console.log('🟢 Client Connected:', socket.id);

    socket.emit('message', 'Connected to realtime server');

    socket.on('disconnect', () => {
        console.log('🔴 Client Disconnected:', socket.id);
    });
});

/*
========================================
POSTGRES LISTEN/NOTIFY
========================================
*/

client.query('LISTEN order_changes');

client.on('notification', (msg) => {

    console.log('📢 Database Change Received');

    const payload = JSON.parse(msg.payload);

    console.log(payload);

    io.emit('order_update', payload);
});

/*
========================================
START SERVER
========================================
*/

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
