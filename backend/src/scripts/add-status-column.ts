import pool from '../config/database';

async function addStatusColumn() {
  try {
    await pool.query(`
      ALTER TABLE itinerary_collaborators 
      ADD COLUMN status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending'
    `);
    console.log('✅ Status column added successfully');
    process.exit(0);
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ Status column already exists');
      process.exit(0);
    }
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addStatusColumn();
