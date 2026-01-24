const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    console.log('Connecting to DB...');
    await pool.query("CREATE TABLE IF NOT EXISTS test_connection (id SERIAL PRIMARY KEY, note TEXT, created_at TIMESTAMP DEFAULT NOW())");
    const insert = await pool.query('INSERT INTO test_connection (note) VALUES ($1) RETURNING id, created_at', ['connected-from-script']);
    console.log('INSERTED:', insert.rows[0]);
    const rows = await pool.query('SELECT * FROM test_connection ORDER BY id DESC LIMIT 5');
    console.log('ROWS:', rows.rows);
    await pool.end();
    console.log('Done.');
  } catch (err) {
    console.error('DB_ERROR', err);
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
})();
