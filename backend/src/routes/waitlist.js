const router = require('express').Router();
const { db } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const waitlistService = require('../services/waitlistService');
const emailService = require('../services/emailService');

// POST /events/:eventId/waitlist/join
router.post('/events/:eventId/join', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });

    // Verify event exists and is published
    const event = await db.oneOrNone(`SELECT id FROM events WHERE id = $1 AND status = 'published'`, [eventId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Verify category exists for this event
    const cat = await db.oneOrNone(
      `SELECT sc.* FROM seat_categories sc
       JOIN event_pricing ep ON ep.category_id = sc.id
       WHERE ep.event_id = $1 AND sc.id = $2`,
      [eventId, categoryId]
    );
    if (!cat) return res.status(404).json({ error: 'Category not found for this event' });

    const entry = await waitlistService.addToWaitlist(eventId, req.user.id, categoryId);
    res.status(201).json({ message: 'Added to waitlist', position: entry.position, entry });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /waitlist/events/:eventId — current customer's waitlist status
router.get('/events/:eventId', authenticate, async (req, res, next) => {
  try {
    const entry = await db.oneOrNone(
      `SELECT w.*, sc.category_name FROM waitlists w
       JOIN seat_categories sc ON sc.id = w.category_id
       WHERE w.event_id = $1 AND w.customer_id = $2
       AND w.status IN ('waiting', 'offered')`,
      [req.params.eventId, req.user.id]
    );
    res.json(entry || null);
  } catch (err) {
    next(err);
  }
});

// DELETE /waitlist/events/:eventId — leave waitlist
router.delete('/events/:eventId', authenticate, async (req, res, next) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });
    await waitlistService.removeFromWaitlist(req.params.eventId, req.user.id, categoryId);
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /waitlist/pending-offers — all pending offers for current customer
router.get('/pending-offers', authenticate, async (req, res, next) => {
  try {
    const offers = await db.any(
      `SELECT w.*, sc.category_name, e.title AS event_title, e.event_date, v.name AS venue_name
       FROM waitlists w
       JOIN seat_categories sc ON sc.id = w.category_id
       JOIN events e ON e.id = w.event_id
       JOIN venues v ON v.id = e.venue_id
       WHERE w.customer_id = $1 AND w.status = 'offered' AND w.offer_expires_at > NOW()`,
      [req.user.id]
    );
    res.json(offers);
  } catch (err) {
    next(err);
  }
});

// POST /waitlist/accept?token=xxx — accept a waitlist offer (also handles link from email)
router.post('/accept', authenticate, async (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    if (!token) return res.status(400).json({ error: 'Offer token is required' });

    const booking = await waitlistService.acceptOffer(token, req.user.id);

    // Generate QR + send email
    const { generateQR } = require('../services/qrService');
    const { filePath, qrDataUrl } = await generateQR(
      booking.bookingReference, booking.bookingId, req.user.id, booking.eventId
    ).catch(() => ({ filePath: null, qrDataUrl: null }));

    if (filePath) await db.none('UPDATE bookings SET qr_code_path = $1 WHERE id = $2', [filePath, booking.bookingId]);

    setImmediate(async () => {
      try {
        const [event, user, fullBooking] = await Promise.all([
          db.oneOrNone(`SELECT e.*, v.name AS venue_name, v.city AS venue_city FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`, [booking.eventId]),
          db.oneOrNone('SELECT * FROM users WHERE id = $1', [req.user.id]),
          db.oneOrNone(
            `SELECT bs.*, sl.row_number, sl.seat_number, sc.category_name FROM booking_seats bs
             JOIN seat_layout sl ON sl.id = bs.seat_id
             JOIN seat_categories sc ON sc.id = sl.category_id
             WHERE bs.booking_id = $1`,
            [booking.bookingId]
          ),
        ]);
        if (event && user) {
          await emailService.sendBookingConfirmation(user, booking, event, fullBooking ? [fullBooking] : [], qrDataUrl, filePath);
        }
      } catch (e) {
        console.error('[Waitlist Accept] Email failed:', e.message);
      }
    });

    res.json({ message: 'Offer accepted! Booking confirmed.', booking, qrDataUrl });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /waitlist/decline?token=xxx
router.post('/decline', authenticate, async (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    if (!token) return res.status(400).json({ error: 'Offer token is required' });

    await waitlistService.declineOffer(token, req.user.id);
    res.json({ message: 'Offer declined. The seat has been offered to the next customer.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
