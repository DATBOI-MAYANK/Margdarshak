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

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Traveler',
    status VARCHAR(20) DEFAULT 'active',
    contact_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS itineraries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget NUMERIC(10,2) NOT NULL,
    activities JSONB,
    notes TEXT,
    media_paths JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (start_date <= end_date),
    CHECK (budget > 0)
  );`,

  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'direct',
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    reference_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS collaboration_chats (
    id SERIAL PRIMARY KEY,
    itinerary_id INTEGER NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS itinerary_collaborators (
    id SERIAL PRIMARY KEY,
    itinerary_id INTEGER NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(10) DEFAULT 'edit',
    invited_by INTEGER NOT NULL REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
    UNIQUE (itinerary_id, user_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_user_id ON itineraries(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_destination ON itineraries(destination);`,
  `CREATE INDEX IF NOT EXISTS idx_dates ON itineraries(start_date, end_date);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);`,
  `CREATE INDEX IF NOT EXISTS idx_collab_chat_itinerary ON collaboration_chats(itinerary_id);`
];

(async () => {
  try {
    console.log('Running Postgres migrations...');
    for (const s of statements) {
      console.log('Executing statement...');
      await pool.query(s);
    }
    console.log('Migrations completed successfully.');
    await pool.end();
  } catch (err) {
    console.error('Migration error:', err);
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
})();
