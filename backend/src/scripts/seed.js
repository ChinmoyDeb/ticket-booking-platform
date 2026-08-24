require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, connectDB } = require('../config/db');

async function seed() {
  await connectDB();
  console.log('[Seed] Truncating existing data...');
  await db.none('TRUNCATE users, venues, events, seat_categories, seat_layout, event_pricing, bookings, booking_seats, seat_holds, waitlists, booking_history CASCADE;');

  console.log('[Seed] Seeding database...');

  // Admin
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10);
  const adminId = uuidv4();
  await db.none(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, 'admin', 'Admin', 'User')`,
    [adminId, process.env.ADMIN_EMAIL || 'admin@tickethub.com', adminHash]
  );

  // Organizer
  const orgHash = await bcrypt.hash('Organizer@123', 10);
  const orgId = uuidv4();
  await db.none(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, 'organizer', 'Alice', 'Events')`,
    [orgId, 'organizer@tickethub.com', orgHash]
  );

  // Customer
  const custHash = await bcrypt.hash('Customer@123', 10);
  const custId = uuidv4();
  await db.none(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, 'customer', 'John', 'Doe')`,
    [custId, 'customer@tickethub.com', custHash]
  );

  // Venues
  const venues = [
    { id: uuidv4(), name: 'Nexus Amphitheater', city: 'Mumbai', address: '42 Bandra West', desc: 'Outdoor concert venue.', rows: 5, seats: 10 },
    { id: uuidv4(), name: 'Starlight Arena', city: 'Delhi', address: '101 CP', desc: 'Indoor sports and music arena.', rows: 8, seats: 12 },
    { id: uuidv4(), name: 'The Grand Theater', city: 'Bangalore', address: '10 MG Road', desc: 'Classic theater for plays and movies.', rows: 4, seats: 8 }
  ];

  for (const v of venues) {
    await db.none(
      `INSERT INTO venues (id, name, city, address, description, total_seats) VALUES ($1, $2, $3, $4, $5, $6)`,
      [v.id, v.name, v.city, v.address, v.desc, v.rows * v.seats]
    );

    const premId = uuidv4();
    const stdId = uuidv4();
    await db.none(`INSERT INTO seat_categories (id, venue_id, category_name, base_price, quantity) VALUES ($1, $2, 'Premium', 2500, ${2 * v.seats})`, [premId, v.id]);
    await db.none(`INSERT INTO seat_categories (id, venue_id, category_name, base_price, quantity) VALUES ($1, $2, 'Standard', 800, ${(v.rows - 2) * v.seats})`, [stdId, v.id]);

    for (let r = 1; r <= v.rows; r++) {
      for (let s = 1; s <= v.seats; s++) {
        await db.none(
          `INSERT INTO seat_layout (id, venue_id, row_number, seat_number, category_id, status) VALUES ($1, $2, $3, $4, $5, 'available')`,
          [uuidv4(), v.id, r, s, r <= 2 ? premId : stdId]
        );
      }
    }
  }

  // 10 Events
  const eventsData = [
    { title: 'QuantumBeat Live', type: 'concert', vIdx: 0, daysOffset: 5, time: '20:00:00' },
    { title: 'Tech Startup Summit', type: 'sports', vIdx: 1, daysOffset: 12, time: '09:00:00' },
    { title: 'Hamlet - The Play', type: 'movie', vIdx: 2, daysOffset: 3, time: '18:30:00' },
    { title: 'Neon Nights Festival', type: 'concert', vIdx: 0, daysOffset: 20, time: '21:00:00' },
    { title: 'National Basketball Final', type: 'sports', vIdx: 1, daysOffset: 15, time: '16:00:00' },
    { title: 'Classic Movie Marathon', type: 'movie', vIdx: 2, daysOffset: 7, time: '12:00:00' },
    { title: 'Symphony Orchestra', type: 'concert', vIdx: 2, daysOffset: 25, time: '19:00:00' },
    { title: 'Standup Comedy Special', type: 'concert', vIdx: 0, daysOffset: 8, time: '20:30:00' },
    { title: 'E-Sports Championship', type: 'sports', vIdx: 1, daysOffset: 30, time: '10:00:00' },
    { title: 'Indie Film Festival', type: 'movie', vIdx: 2, daysOffset: 2, time: '14:00:00' }
  ];

  for (const ed of eventsData) {
    const eventId = uuidv4();
    const v = venues[ed.vIdx];
    const date = new Date();
    date.setDate(date.getDate() + ed.daysOffset);
    const eventDate = date.toISOString().split('T')[0];

    await db.none(
      `INSERT INTO events (id, organizer_id, venue_id, title, description, event_type, event_date, event_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')`,
      [eventId, orgId, v.id, ed.title, 'An amazing event you do not want to miss.', ed.type, eventDate, ed.time]
    );

    // Clone seat layout
    await db.none(
      `INSERT INTO seat_layout (id, venue_id, event_id, row_number, seat_number, category_id, status)
       SELECT uuid_generate_v4(), venue_id, $1, row_number, seat_number, category_id, 'available'
       FROM seat_layout WHERE venue_id = $2 AND event_id IS NULL`,
      [eventId, v.id]
    );

    // Set pricing based on categories
    const cats = await db.any(`SELECT id, category_name FROM seat_categories WHERE venue_id = $1`, [v.id]);
    for (const c of cats) {
      const price = c.category_name === 'Premium' ? (Math.floor(Math.random() * 3) + 2) * 1000 : (Math.floor(Math.random() * 5) + 5) * 100;
      await db.none(
        `INSERT INTO event_pricing (id, event_id, category_id, price) VALUES ($1, $2, $3, $4)`,
        [uuidv4(), eventId, c.id, price]
      );
    }
  }

  console.log('[Seed] Done! Seeded 3 Venues and 10 Events.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});
