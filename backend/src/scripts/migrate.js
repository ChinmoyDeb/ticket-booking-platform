require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, connectDB } = require('../config/db');

async function migrate() {
  await connectDB();
  const sqlFile = path.join(__dirname, '../../migrations/001_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  console.log('[Migrate] Running schema migration...');
  await db.task(async (t) => {
    await t.none(sql);
  });
  console.log('[Migrate] Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migrate] Error:', err.message);
  process.exit(1);
});
