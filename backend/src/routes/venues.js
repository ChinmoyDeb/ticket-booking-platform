const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// ── VENUES ────────────────────────────────────────────────────────────────────

// GET /venues
router.get('/', async (req, res, next) => {
  try {
    const venues = await db.any(
      `SELECT v.*, 
        json_agg(json_build_object(
          'id', sc.id,
          'categoryName', sc.category_name,
          'basePrice', sc.base_price,
          'quantity', sc.quantity
        )) FILTER (WHERE sc.id IS NOT NULL) AS categories
       FROM venues v
       LEFT JOIN seat_categories sc ON sc.venue_id = v.id
       GROUP BY v.id
       ORDER BY v.name`
    );
    res.json(venues);
  } catch (err) {
    next(err);
  }
});

// GET /venues/:id
router.get('/:id', async (req, res, next) => {
  try {
    const venue = await db.oneOrNone(
      `SELECT v.*,
        json_agg(json_build_object(
          'id', sc.id,
          'categoryName', sc.category_name,
          'basePrice', sc.base_price,
          'quantity', sc.quantity
        )) FILTER (WHERE sc.id IS NOT NULL) AS categories
       FROM venues v
       LEFT JOIN seat_categories sc ON sc.venue_id = v.id
       WHERE v.id = $1
       GROUP BY v.id`,
      [req.params.id]
    );
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json(venue);
  } catch (err) {
    next(err);
  }
});

// POST /venues (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, city, address, description, categories } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'Name and city are required' });
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'At least one seat category is required' });
    }

    const totalSeats = categories.reduce((sum, c) => sum + (c.quantity || 0), 0);

    const venue = await db.tx(async (t) => {
      const v = await t.one(
        `INSERT INTO venues (id, name, city, address, description, total_seats)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [uuidv4(), name, city, address || null, description || null, totalSeats]
      );

      const cats = [];
      for (const cat of categories) {
        // Insert category
        const c = await t.one(
          `INSERT INTO seat_categories (id, venue_id, category_name, base_price, quantity)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [uuidv4(), v.id, cat.categoryName, cat.basePrice || 0, cat.quantity || 0]
        );
        cats.push(c);

        // Generate seat_layout rows for this category
        let seatNum = 1;
        const rowsNeeded = Math.ceil(cat.quantity / 10); // 10 seats per row
        for (let row = 1; row <= rowsNeeded; row++) {
          const seatsInRow = Math.min(10, cat.quantity - (row - 1) * 10);
          for (let s = 1; s <= seatsInRow; s++) {
            await t.none(
              `INSERT INTO seat_layout (id, venue_id, row_number, seat_number, category_id, status)
               VALUES ($1, $2, $3, $4, $5, 'available')`,
              [uuidv4(), v.id, row + (cats.length - 1) * rowsNeeded, s, c.id]
            );
            seatNum++;
          }
        }
      }

      return { ...v, categories: cats };
    });

    res.status(201).json(venue);
  } catch (err) {
    next(err);
  }
});

// PUT /venues/:id (admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, city, address, description } = req.body;
    const venue = await db.oneOrNone(
      `UPDATE venues SET name = COALESCE($1, name), city = COALESCE($2, city),
       address = COALESCE($3, address), description = COALESCE($4, description)
       WHERE id = $5 RETURNING *`,
      [name, city, address, description, req.params.id]
    );
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json(venue);
  } catch (err) {
    next(err);
  }
});

// DELETE /venues/:id (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.result('DELETE FROM venues WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Venue not found' });
    res.json({ message: 'Venue deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
