const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

client.connect()
    .then(() => {
        console.log('✅ PostgreSQL Connected');
    })
    .catch((err) => {
        console.error('❌ DB Connection Error:', err);
    });

module.exports = client;