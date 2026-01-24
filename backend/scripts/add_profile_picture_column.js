const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    console.log('Adding profile_picture column if missing...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255);`);
    console.log('Column ensured.');
  } catch (err) {
    console.error('Error adding column:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
