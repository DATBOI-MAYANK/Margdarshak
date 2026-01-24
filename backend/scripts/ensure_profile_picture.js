// Ensures users.profile_picture column exists in Postgres
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
});

(async () => {
  try {
    console.log('Connecting to database...');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255);");
    console.log('✓ Ensured users.profile_picture column exists');
  } catch (err) {
    console.error('✗ Error ensuring profile_picture column:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
