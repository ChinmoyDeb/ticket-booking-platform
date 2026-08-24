require('dotenv').config();
const pgp = require('pg-promise')({
  // Transform DB column names: snake_case → camelCase for all query results
  // NOTE: pg-promise v11 receive event receives { data, result, ctx } object
  receive({ data }) {
    camelizeColumns(data);
  },
  error(err, e) {
    if (e.cn) {
      console.error('[DB] Connection error:', err.message);
    }
    if (e.query) {
      console.error('[DB] Query error:', e.query);
      if (e.params) console.error('[DB] Params:', e.params);
    }
  },
});

function camelizeColumns(data) {
  if (!data || data.length === 0) return;
  // Collect all snake_case → camelCase transformations from the first row
  const transforms = [];
  for (const prop of Object.keys(data[0])) {
    const camel = prop.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (camel !== prop) transforms.push({ from: prop, to: camel });
  }
  if (transforms.length === 0) return;
  // Apply to all rows in one pass (avoids iterating while mutating)
  for (const row of data) {
    for (const { from, to } of transforms) {
      row[to] = row[from];
      delete row[from];
    }
  }
}


const connectionString = process.env.DATABASE_URL;

const db = pgp({
  connectionString,
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function connectDB() {
  const conn = await db.connect();
  await conn.none("SET timezone = 'UTC'");
  conn.done();
  console.log('[DB] PostgreSQL connected successfully');
}

module.exports = { db, connectDB };
