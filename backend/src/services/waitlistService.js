const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { db } = require('../config/db');
const emailService = require('./emailService');

const OFFER_TTL = () => parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES) || 15;

/**
 * Add a customer to the waitlist for a specific category of an event.
 * Assigns the next available position.
 */
async function addToWaitlist(eventId, customerId, categoryId) {
  // Check if already on waitlist
  const existing = await db.oneOrNone(
    `SELECT id, status FROM waitlists
     WHERE event_id = $1 AND customer_id = $2 AND category_id = $3
     AND status IN ('waiting', 'offered')`,
    [eventId, customerId, categoryId]
  );
  if (existing) {
    const err = new Error('You are already on the waitlist for this category');
    err.status = 409;
    throw err;
  }

  // Get next position
  const posRow = await db.oneOrNone(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
     FROM waitlists WHERE event_id = $1 AND category_id = $2`,
    [eventId, categoryId]
  );

  const position = posRow.nextPos;

  const entry = await db.one(
    `INSERT INTO waitlists (id, event_id, customer_id, category_id, position)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [uuidv4(), eventId, customerId, categoryId, position]
  );

  return entry;
}

/**
 * Remove a customer from the waitlist and compact positions.
 */
async function removeFromWaitlist(eventId, customerId, categoryId) {
  const entry = await db.oneOrNone(
    `SELECT id, position FROM waitlists
     WHERE event_id = $1 AND customer_id = $2 AND category_id = $3 AND status = 'waiting'`,
    [eventId, customerId, categoryId]
  );
  if (!entry) {
    const err = new Error('Waitlist entry not found');
    err.status = 404;
    throw err;
  }

  await db.tx(async (t) => {
    await t.none(`DELETE FROM waitlists WHERE id = $1`, [entry.id]);
    // Compact positions
    await t.none(
      `UPDATE waitlists SET position = position - 1
       WHERE event_id = $1 AND category_id = $2 AND position > $3 AND status = 'waiting'`,
      [eventId, categoryId, entry.position]
    );
  });
}

/**
 * When a seat is freed (on cancellation), offer it to the next waiting customer.
 * Called inside the cancellation transaction.
 */
async function offerNextInQueue(t, eventId, categoryId, seatId) {
  const next = await t.oneOrNone(
    `SELECT w.*, u.email, u.first_name, u.last_name
     FROM waitlists w
     JOIN users u ON u.id = w.customer_id
     WHERE w.event_id = $1 AND w.category_id = $2 AND w.status = 'waiting'
     ORDER BY w.position ASC LIMIT 1`,
    [eventId, categoryId]
  );

  if (!next) return null; // No one waiting

  const offerToken = crypto.randomBytes(32).toString('hex');
  const offerExpiresAt = new Date(Date.now() + OFFER_TTL() * 60 * 1000);

  // Update waitlist entry
  await t.none(
    `UPDATE waitlists
     SET status = 'offered', offered_seat_id = $1, offer_token = $2, offer_expires_at = $3
     WHERE id = $4`,
    [seatId, offerToken, offerExpiresAt, next.id]
  );

  // Hold the seat for this customer temporarily
  await t.none(
    `UPDATE seat_layout SET status = 'held' WHERE id = $1`,
    [seatId]
  );

  return { next, offerToken, offerExpiresAt };
}

/**
 * Accept a waitlist offer — create booking from the offered seat.
 */
async function acceptOffer(offerToken, customerId) {
  const entry = await db.oneOrNone(
    `SELECT w.*, sc.category_name, ep.price
     FROM waitlists w
     JOIN seat_categories sc ON sc.id = w.category_id
     JOIN event_pricing ep ON ep.event_id = w.event_id AND ep.category_id = w.category_id
     WHERE w.offer_token = $1 AND w.customer_id = $2 AND w.status = 'offered'`,
    [offerToken, customerId]
  );

  if (!entry) {
    const err = new Error('Offer not found or does not belong to you');
    err.status = 404;
    throw err;
  }

  if (new Date(entry.offerExpiresAt) < new Date()) {
    const err = new Error('This offer has expired');
    err.status = 410;
    throw err;
  }

  // Create booking inside a transaction
  const booking = await db.tx(async (t) => {
    // Lock the seat
    const seat = await t.oneOrNone(
      `SELECT id, row_number, seat_number FROM seat_layout WHERE id = $1 FOR UPDATE`,
      [entry.offeredSeatId]
    );
    if (!seat) throw Object.assign(new Error('Seat no longer available'), { status: 409 });

    const bookingRef = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const bookingId = uuidv4();

    await t.none(
      `INSERT INTO bookings (id, event_id, customer_id, booking_reference, total_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, entry.eventId, customerId, bookingRef, entry.price]
    );
    await t.none(
      `INSERT INTO booking_seats (id, booking_id, seat_id, price) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), bookingId, seat.id, entry.price]
    );
    await t.none(`UPDATE seat_layout SET status = 'booked' WHERE id = $1`, [seat.id]);
    await t.none(`UPDATE waitlists SET status = 'completed' WHERE id = $1`, [entry.id]);

    return { bookingId, bookingReference: bookingRef, totalAmount: entry.price };
  });

  return booking;
}

/**
 * Decline a waitlist offer. Move to the next customer in queue.
 */
async function declineOffer(offerToken, customerId) {
  const entry = await db.oneOrNone(
    `SELECT * FROM waitlists
     WHERE offer_token = $1 AND customer_id = $2 AND status = 'offered'`,
    [offerToken, customerId]
  );

  if (!entry) {
    const err = new Error('Offer not found');
    err.status = 404;
    throw err;
  }

  await db.tx(async (t) => {
    await t.none(`UPDATE waitlists SET status = 'cancelled' WHERE id = $1`, [entry.id]);
    // Release seat and offer to next
    await t.none(`UPDATE seat_layout SET status = 'available' WHERE id = $1`, [entry.offeredSeatId]);
    // Compact positions for remaining 'waiting' entries
    await t.none(
      `UPDATE waitlists SET position = position - 1
       WHERE event_id = $1 AND category_id = $2 AND status = 'waiting'`,
      [entry.eventId, entry.categoryId]
    );

    const offer = await offerNextInQueue(t, entry.eventId, entry.categoryId, entry.offeredSeatId);
    if (offer) {
      // Send email asynchronously after transaction
      setImmediate(async () => {
        try {
          const event = await db.oneOrNone(
            `SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`,
            [entry.eventId]
          );
          const user = await db.oneOrNone(`SELECT * FROM users WHERE id = $1`, [offer.next.customerId]);
          if (event && user) {
            await emailService.sendWaitlistOffer(user, event, { categoryName: offer.next.categoryName }, offer.offerToken);
          }
        } catch (e) {
          console.error('[Waitlist] Email send failed:', e.message);
        }
      });
    }
  });
}

/**
 * Scheduler target: process expired offers and advance queue.
 */
async function processExpiredOffers() {
  const expired = await db.any(
    `SELECT * FROM waitlists WHERE status = 'offered' AND offer_expires_at < NOW()`
  );

  let count = 0;
  for (const entry of expired) {
    await db.tx(async (t) => {
      await t.none(`UPDATE waitlists SET status = 'expired' WHERE id = $1`, [entry.id]);
      // Release the seat back to available
      if (entry.offeredSeatId) {
        await t.none(`UPDATE seat_layout SET status = 'available' WHERE id = $1 AND status = 'held'`, [entry.offeredSeatId]);
      }
      // Compact positions
      await t.none(
        `UPDATE waitlists SET position = position - 1
         WHERE event_id = $1 AND category_id = $2 AND status = 'waiting'`,
        [entry.eventId, entry.categoryId]
      );
      // Offer to next in queue
      if (entry.offeredSeatId) {
        const offer = await offerNextInQueue(t, entry.eventId, entry.categoryId, entry.offeredSeatId);
        if (offer) {
          setImmediate(async () => {
            try {
              const event = await db.oneOrNone(
                `SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`,
                [entry.eventId]
              );
              const user = await db.oneOrNone(`SELECT * FROM users WHERE id = $1`, [offer.next.customerId]);
              if (event && user) {
                await emailService.sendWaitlistOffer(user, event, { categoryName: offer.next.categoryName }, offer.offerToken);
              }
            } catch (e) {
              console.error('[Waitlist] Auto-offer email failed:', e.message);
            }
          });
        }
      }
    });
    count++;
  }

  if (count > 0) console.log(`[Waitlist] Processed ${count} expired offer(s)`);
  return count;
}

module.exports = {
  addToWaitlist,
  removeFromWaitlist,
  offerNextInQueue,
  acceptOffer,
  declineOffer,
  processExpiredOffers,
};
