const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// ── LIST EVENTS ───────────────────────────────────────────────────────────────
// GET /events?page=1&limit=12&search=&dateFrom=&dateTo=&eventType=&venueId=&sortBy=date
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search = '', dateFrom, dateTo, eventType, venueId, sortBy = 'date' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [`e.status = 'published'`];
    const params = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(e.title ILIKE $${pIdx} OR e.description ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }
    if (dateFrom) { conditions.push(`e.event_date >= $${pIdx}`); params.push(dateFrom); pIdx++; }
    if (dateTo)   { conditions.push(`e.event_date <= $${pIdx}`); params.push(dateTo); pIdx++; }
    if (eventType){ conditions.push(`e.event_type = $${pIdx}`); params.push(eventType); pIdx++; }
    if (venueId)  { conditions.push(`e.venue_id = $${pIdx}`); params.push(venueId); pIdx++; }

    const where = 'WHERE ' + conditions.join(' AND ');
    const orderMap = { date: 'e.event_date ASC', price: 'min_price ASC', availability: 'available_seats DESC' };
    const orderBy = orderMap[sortBy] || 'e.event_date ASC';

    const [events, countRow] = await Promise.all([
      db.any(
        `SELECT e.*,
          v.name AS venue_name, v.city AS venue_city,
          u.first_name AS organizer_first, u.last_name AS organizer_last,
          MIN(ep.price) AS min_price,
          COUNT(sl.id) FILTER (WHERE sl.status = 'available') AS available_seats,
          COUNT(sl.id) AS total_seats
         FROM events e
         JOIN venues v ON v.id = e.venue_id
         JOIN users u ON u.id = e.organizer_id
         LEFT JOIN seat_layout sl ON sl.event_id = e.id
         LEFT JOIN event_pricing ep ON ep.event_id = e.id
         ${where}
         GROUP BY e.id, v.name, v.city, u.first_name, u.last_name
         ORDER BY ${orderBy}
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        [...params, parseInt(limit), offset]
      ),
      db.one(`SELECT COUNT(*) FROM events e ${where}`, params),
    ]);

    res.json({ events, total: parseInt(countRow.count), pages: Math.ceil(countRow.count / limit), page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// ── GET ORGANIZER'S EVENTS ────────────────────────────────────────────────────
router.get('/organizer/me', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const events = await db.any(
      `SELECT e.*,
        v.name AS venue_name, v.city AS venue_city,
        MIN(ep.price) AS min_price,
        COUNT(sl.id) FILTER (WHERE sl.status = 'available') AS available_seats,
        COUNT(sl.id) AS total_seats
       FROM events e
       JOIN venues v ON v.id = e.venue_id
       LEFT JOIN seat_layout sl ON sl.event_id = e.id
       LEFT JOIN event_pricing ep ON ep.event_id = e.id
       WHERE e.organizer_id = $1 OR $2 = 'admin'
       GROUP BY e.id, v.name, v.city
       ORDER BY e.created_at DESC`,
      [req.user.id, req.user.role]
    );
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

// ── GET SINGLE EVENT ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const event = await db.oneOrNone(
      `SELECT e.*,
        v.name AS venue_name, v.city AS venue_city, v.address AS venue_address,
        u.first_name AS organizer_first, u.last_name AS organizer_last, u.email AS organizer_email,
        json_agg(DISTINCT jsonb_build_object(
          'categoryId', sc.id,
          'categoryName', sc.category_name,
          'price', ep.price,
          'quantity', sc.quantity,
          'availableSeats', (SELECT COUNT(*) FROM seat_layout sl2 WHERE sl2.event_id = e.id AND sl2.category_id = sc.id AND sl2.status = 'available')
        )) FILTER (WHERE sc.id IS NOT NULL) AS pricing
       FROM events e
       JOIN venues v ON v.id = e.venue_id
       JOIN users u ON u.id = e.organizer_id
       LEFT JOIN event_pricing ep ON ep.event_id = e.id
       LEFT JOIN seat_categories sc ON sc.id = ep.category_id
       WHERE e.id = $1
       GROUP BY e.id, v.name, v.city, v.address, u.first_name, u.last_name, u.email`,
      [req.params.id]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// ── GET SEAT MAP ──────────────────────────────────────────────────────────────
// GET /events/:id/seat-map  — returns all seats with current status
router.get('/:id/seat-map', async (req, res, next) => {
  try {
    const seats = await db.any(
      `SELECT sl.id, sl.row_number, sl.seat_number, sl.status,
        sc.category_name, ep.price
       FROM seat_layout sl
       JOIN seat_categories sc ON sc.id = sl.category_id
       LEFT JOIN event_pricing ep ON ep.event_id = sl.event_id AND ep.category_id = sl.category_id
       WHERE sl.event_id = $1
       ORDER BY sl.row_number, sl.seat_number`,
      [req.params.id]
    );

    // Group by row
    const map = {};
    for (const seat of seats) {
      if (!map[seat.rowNumber]) map[seat.rowNumber] = [];
      map[seat.rowNumber].push(seat);
    }
    res.json({ seatMap: map, totalSeats: seats.length });
  } catch (err) {
    next(err);
  }
});

// ── CREATE EVENT ──────────────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const { title, description, eventType, eventDate, eventTime, venueId, pricing, imageUrl } = req.body;
    if (!title || !eventDate || !eventTime || !venueId) {
      return res.status(400).json({ error: 'title, eventDate, eventTime, venueId are required' });
    }
    if (new Date(eventDate) < new Date()) {
      return res.status(400).json({ error: 'Event date must be in the future' });
    }

    const event = await db.tx(async (t) => {
      const e = await t.one(
        `INSERT INTO events (id, organizer_id, venue_id, title, description, event_type, event_date, event_time, image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published') RETURNING *`,
        [uuidv4(), req.user.id, venueId, title, description || null, eventType || 'concert', eventDate, eventTime, imageUrl || null]
      );

      // Clone seat_layout from venue template to this event
      await t.none(
        `INSERT INTO seat_layout (id, venue_id, event_id, row_number, seat_number, category_id, status)
         SELECT uuid_generate_v4(), venue_id, $1, row_number, seat_number, category_id, 'available'
         FROM seat_layout
         WHERE venue_id = $2 AND event_id IS NULL`,
        [e.id, venueId]
      );

      // Insert pricing per category
      if (pricing && Array.isArray(pricing)) {
        for (const p of pricing) {
          await t.none(
            `INSERT INTO event_pricing (id, event_id, category_id, price) VALUES ($1, $2, $3, $4)`,
            [uuidv4(), e.id, p.categoryId, p.price]
          );
        }
      }

      return e;
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// ── PUBLISH EVENT ─────────────────────────────────────────────────────────────
router.patch('/:id/publish', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const event = await db.oneOrNone(
      `UPDATE events SET status = 'published' WHERE id = $1 AND organizer_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!event) return res.status(404).json({ error: 'Event not found or not yours' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// ── UPDATE EVENT ──────────────────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const { title, description, eventDate, eventTime, status, imageUrl } = req.body;
    const event = await db.oneOrNone(
      `UPDATE events
       SET title = COALESCE($1, title), description = COALESCE($2, description),
           event_date = COALESCE($3, event_date), event_time = COALESCE($4, event_time),
           status = COALESCE($5, status), image_url = COALESCE($6, image_url)
       WHERE id = $7 AND (organizer_id = $8 OR $9 = 'admin')
       RETURNING *`,
      [title, description, eventDate, eventTime, status, imageUrl, req.params.id, req.user.id, req.user.role]
    );
    if (!event) return res.status(404).json({ error: 'Event not found or access denied' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// ── CANCEL EVENT ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    await db.tx(async (t) => {
      const e = await t.oneOrNone(
        `UPDATE events SET status = 'cancelled' WHERE id = $1 AND (organizer_id = $2 OR $3 = 'admin') RETURNING id`,
        [req.params.id, req.user.id, req.user.role]
      );
      if (!e) throw Object.assign(new Error('Event not found or access denied'), { status: 404 });
      // Release all held seats
      await t.none(`DELETE FROM seat_holds WHERE event_id = $1`, [e.id]);
      await t.none(`UPDATE seat_layout SET status = 'available' WHERE event_id = $1 AND status = 'held'`, [e.id]);
    });
    res.json({ message: 'Event cancelled' });
  } catch (err) {
    next(err);
  }
});

// ── ORGANIZER: BOOKING SUMMARY & REVENUE ─────────────────────────────────────
router.get('/:id/bookings', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const event = await db.oneOrNone(
      `SELECT id FROM events WHERE id = $1 AND (organizer_id = $2 OR $3 = 'admin')`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!event) return res.status(404).json({ error: 'Event not found or access denied' });

    const [summary, bookings] = await Promise.all([
      db.one(
        `SELECT
          COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS total_bookings,
          COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'confirmed'), 0) AS total_revenue,
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') AS cancellations
         FROM bookings b WHERE b.event_id = $1`,
        [req.params.id]
      ),
      db.any(
        `SELECT b.id, b.booking_reference, b.total_amount, b.status, b.created_at,
          u.email AS customer_email, u.first_name, u.last_name,
          json_agg(json_build_object('row', sl.row_number, 'seat', sl.seat_number, 'category', sc.category_name)) AS seats
         FROM bookings b
         JOIN users u ON u.id = b.customer_id
         JOIN booking_seats bs ON bs.booking_id = b.id
         JOIN seat_layout sl ON sl.id = bs.seat_id
         JOIN seat_categories sc ON sc.id = sl.category_id
         WHERE b.event_id = $1
         GROUP BY b.id, u.email, u.first_name, u.last_name
         ORDER BY b.created_at DESC`,
        [req.params.id]
      ),
    ]);

    res.json({ summary, bookings });
  } catch (err) {
    next(err);
  }
});

// GET /events/:id/revenue
router.get('/:id/revenue', authenticate, requireRole('organizer', 'admin'), async (req, res, next) => {
  try {
    const revenueByCategory = await db.any(
      `SELECT sc.category_name,
        COUNT(bs.id) AS tickets_sold,
        SUM(bs.price) AS revenue
       FROM booking_seats bs
       JOIN seat_layout sl ON sl.id = bs.seat_id
       JOIN seat_categories sc ON sc.id = sl.category_id
       JOIN bookings b ON b.id = bs.booking_id
       WHERE b.event_id = $1 AND b.status = 'confirmed'
       GROUP BY sc.category_name`,
      [req.params.id]
    );
    res.json({ revenueByCategory });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
