const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { holdSeat, releaseSeat } = require('../services/seatHoldService');
const { generateQR, verifyQR } = require('../services/qrService');
const emailService = require('../services/emailService');
const waitlistService = require('../services/waitlistService');

// ── HOLD SEATS ────────────────────────────────────────────────────────────────
// POST /bookings/events/:eventId/seats/hold
router.post('/events/:eventId/seats/hold', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { seatIds } = req.body;
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'seatIds array is required' });
    }

    const holds = [];
    const errors = [];

    for (const seatId of seatIds) {
      try {
        const result = await holdSeat(eventId, seatId, req.user.id);
        holds.push({ seatId, holdId: result.holdId, expiresAt: result.expiresAt });
      } catch (err) {
        errors.push({ seatId, error: err.message });
        // Release any already-held seats on failure
        for (const held of holds) {
          await releaseSeat(eventId, held.seatId).catch(() => {});
        }
        return res.status(err.status || 409).json({ error: err.message, seatId, errors });
      }
    }

    const ttl = parseInt(process.env.SEAT_HOLD_TTL_MINUTES) || 10;
    res.json({ holds, expiresIn: ttl * 60 });
  } catch (err) {
    next(err);
  }
});

// ── RELEASE HOLD ──────────────────────────────────────────────────────────────
// DELETE /bookings/events/:eventId/seats/:seatId/hold
router.delete('/events/:eventId/seats/:seatId/hold', authenticate, async (req, res, next) => {
  try {
    const { eventId, seatId } = req.params;
    // Verify customer owns this hold
    const hold = await db.oneOrNone(
      'SELECT id FROM seat_holds WHERE event_id = $1 AND seat_id = $2 AND customer_id = $3',
      [eventId, seatId, req.user.id]
    );
    if (!hold) return res.status(404).json({ error: 'Hold not found or not yours' });

    await releaseSeat(eventId, seatId);
    res.json({ message: 'Hold released' });
  } catch (err) {
    next(err);
  }
});

// ── CREATE BOOKING ────────────────────────────────────────────────────────────
// POST /bookings
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { eventId, seatIds } = req.body;
    if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'eventId and seatIds are required' });
    }

    // Verify all seats are held by this customer and not expired
    for (const seatId of seatIds) {
      const hold = await db.oneOrNone(
        'SELECT id FROM seat_holds WHERE event_id = $1 AND seat_id = $2 AND customer_id = $3 AND hold_expires_at > NOW()',
        [eventId, seatId, req.user.id]
      );
      if (!hold) {
        return res.status(409).json({ error: `Seat ${seatId} is not held by you or hold has expired` });
      }
    }

    const bookingRef = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const bookingId = uuidv4();

    const booking = await db.tx(async (t) => {
      // Lock all seats + verify still valid
      let total = 0;
      const seatDetails = [];

      for (const seatId of seatIds) {
        const seat = await t.oneOrNone(
          `SELECT sl.id, sl.row_number, sl.seat_number, sl.category_id, ep.price,
            sc.category_name
           FROM seat_layout sl
           JOIN seat_categories sc ON sc.id = sl.category_id
           JOIN event_pricing ep ON ep.event_id = sl.event_id AND ep.category_id = sl.category_id
           WHERE sl.id = $1 AND sl.event_id = $2 AND sl.status = 'held'
           FOR UPDATE`,
          [seatId, eventId]
        );
        if (!seat) throw Object.assign(new Error(`Seat is no longer available`), { status: 409 });
        total += parseFloat(seat.price);
        seatDetails.push(seat);
      }

      // Create booking
      await t.none(
        `INSERT INTO bookings (id, event_id, customer_id, booking_reference, total_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [bookingId, eventId, req.user.id, bookingRef, total]
      );

      // Create booking_seats
      for (const seat of seatDetails) {
        await t.none(
          `INSERT INTO booking_seats (id, booking_id, seat_id, price) VALUES ($1, $2, $3, $4)`,
          [uuidv4(), bookingId, seat.id, seat.price]
        );
        await t.none(`UPDATE seat_layout SET status = 'booked' WHERE id = $1`, [seat.id]);
        await t.none(`DELETE FROM seat_holds WHERE event_id = $1 AND seat_id = $2`, [eventId, seat.id]);
      }

      // Booking history
      await t.none(
        `INSERT INTO booking_history (id, booking_id, action, created_by) VALUES ($1, $2, 'created', $3)`,
        [uuidv4(), bookingId, req.user.id]
      );

      return { bookingId, bookingReference: bookingRef, totalAmount: total, seatDetails, eventId };
    });

    // Generate QR code
    const { filePath, qrDataUrl } = await generateQR(bookingRef, bookingId, req.user.id, eventId);

    // Save QR path to booking
    await db.none('UPDATE bookings SET qr_code_path = $1 WHERE id = $2', [filePath, bookingId]);

    // Fetch event + user for email
    const [event, user] = await Promise.all([
      db.oneOrNone(`SELECT e.*, v.name AS venue_name, v.city AS venue_city FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`, [eventId]),
      db.oneOrNone('SELECT * FROM users WHERE id = $1', [req.user.id]),
    ]);

    // Send confirmation email (non-blocking)
    setImmediate(async () => {
      try {
        await emailService.sendBookingConfirmation(user, booking, event, booking.seatDetails, qrDataUrl, filePath);
      } catch (e) {
        console.error('[Booking] Confirmation email failed:', e.message);
      }
    });

    res.status(201).json({ booking, qrDataUrl });
  } catch (err) {
    next(err);
  }
});

// ── GET BOOKING ───────────────────────────────────────────────────────────────
router.get('/customer/all', authenticate, async (req, res, next) => {
  try {
    const bookings = await db.any(
      `SELECT b.*,
        e.title AS event_title, e.event_date, e.event_time, e.event_type,
        v.name AS venue_name, v.city AS venue_city,
        json_agg(json_build_object(
          'row', sl.row_number, 'seat', sl.seat_number, 'category', sc.category_name, 'price', bs.price
        )) AS seats
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       JOIN venues v ON v.id = e.venue_id
       JOIN booking_seats bs ON bs.booking_id = b.id
       JOIN seat_layout sl ON sl.id = bs.seat_id
       JOIN seat_categories sc ON sc.id = sl.category_id
       WHERE b.customer_id = $1
       GROUP BY b.id, e.title, e.event_date, e.event_time, e.event_type, v.name, v.city
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

router.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const booking = await db.oneOrNone(
      `SELECT b.*,
        e.title AS event_title, e.event_date, e.event_time,
        v.name AS venue_name, v.city AS venue_city,
        json_agg(json_build_object(
          'row', sl.row_number, 'seat', sl.seat_number, 'category', sc.category_name, 'price', bs.price
        )) AS seats
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       JOIN venues v ON v.id = e.venue_id
       JOIN booking_seats bs ON bs.booking_id = b.id
       JOIN seat_layout sl ON sl.id = bs.seat_id
       JOIN seat_categories sc ON sc.id = sl.category_id
       WHERE b.id = $1 AND b.customer_id = $2
       GROUP BY b.id, e.title, e.event_date, e.event_time, v.name, v.city`,
      [req.params.bookingId, req.user.id]
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

// ── CANCEL BOOKING ────────────────────────────────────────────────────────────
router.put('/:bookingId/cancel', authenticate, async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await db.oneOrNone(
      `SELECT b.*, e.venue_id FROM bookings b JOIN events e ON e.id = b.event_id
       WHERE b.id = $1 AND b.customer_id = $2 AND b.status = 'confirmed'`,
      [bookingId, req.user.id]
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found or already cancelled' });

    // Get seats before cancelling
    const bookedSeats = await db.any(
      `SELECT bs.seat_id, sl.category_id FROM booking_seats bs
       JOIN seat_layout sl ON sl.id = bs.seat_id
       WHERE bs.booking_id = $1`,
      [bookingId]
    );

    await db.tx(async (t) => {
      await t.none(`UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`, [bookingId]);
      await t.none(
        `INSERT INTO booking_history (id, booking_id, action, created_by) VALUES ($1, $2, 'cancelled', $3)`,
        [uuidv4(), bookingId, req.user.id]
      );

      for (const seat of bookedSeats) {
        await t.none(`UPDATE seat_layout SET status = 'available' WHERE id = $1`, [seat.seatId]);
        // Offer to next in waitlist
        const offer = await waitlistService.offerNextInQueue(t, booking.eventId, seat.categoryId, seat.seatId);
        if (offer) {
          setImmediate(async () => {
            try {
              const event = await db.oneOrNone(
                `SELECT e.*, v.name AS venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`,
                [booking.eventId]
              );
              const user = await db.oneOrNone(`SELECT * FROM users WHERE id = $1`, [offer.next.customerId]);
              if (event && user) {
                await emailService.sendWaitlistOffer(user, event, { categoryName: offer.next.categoryName }, offer.offerToken);
              }
            } catch (e) {
              console.error('[Cancel] Waitlist email failed:', e.message);
            }
          });
        }
      }
    });

    // Send cancellation email (non-blocking)
    const [event, user] = await Promise.all([
      db.oneOrNone(`SELECT e.*, v.name AS venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`, [booking.eventId]),
      db.oneOrNone(`SELECT * FROM users WHERE id = $1`, [req.user.id]),
    ]);
    setImmediate(() => emailService.sendBookingCancellation(user, booking, event).catch(console.error));

    res.json({ message: 'Booking cancelled', refund: booking.totalAmount });
  } catch (err) {
    next(err);
  }
});

// ── VERIFY QR ─────────────────────────────────────────────────────────────────
router.post('/verify-qr', async (req, res, next) => {
  try {
    const { qrData } = req.body;
    if (!qrData) return res.status(400).json({ error: 'qrData is required' });

    const result = verifyQR(qrData);
    if (!result.valid) return res.status(400).json({ valid: false, error: result.error });

    const booking = await db.oneOrNone(
      `SELECT b.*, e.title, e.event_date FROM bookings b JOIN events e ON e.id = b.event_id
       WHERE b.id = $1`,
      [result.bookingId]
    );

    if (!booking) return res.status(404).json({ valid: false, error: 'Booking not found' });

    // Log verification
    await db.none(
      `INSERT INTO booking_history (id, booking_id, action, details) VALUES ($1, $2, 'verified', $3)`,
      [uuidv4(), booking.id, JSON.stringify({ verifiedAt: new Date() })]
    );

    res.json({ valid: true, booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
