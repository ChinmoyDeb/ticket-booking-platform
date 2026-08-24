const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');
const { db } = require('../config/db');

const HOLD_KEY = (eventId, seatId) => `hold:${eventId}:${seatId}`;
const LOCK_KEY = (eventId, seatId) => `lock:${eventId}:${seatId}`;
const LOCK_TTL = 30; // seconds

/**
 * Acquire a Redis distributed lock for a specific seat.
 * Uses SET NX EX — atomic, no race condition.
 */
async function acquireLock(eventId, seatId) {
  const lockValue = uuidv4();
  const result = await redis.set(LOCK_KEY(eventId, seatId), lockValue, 'NX', 'EX', LOCK_TTL);
  return result === 'OK' ? lockValue : null;
}

/**
 * Release the lock ONLY if we own it (compare-and-delete via Lua script).
 */
async function releaseLock(eventId, seatId, lockValue) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, LOCK_KEY(eventId, seatId), lockValue);
}

/**
 * Hold a seat with distributed lock + DB transaction.
 * Guarantees: only one customer can hold a seat at a time.
 *
 * @returns {Promise<{holdId: string, expiresAt: Date}>}
 * @throws if seat is unavailable or lock cannot be acquired
 */
async function holdSeat(eventId, seatId, customerId, ttlMinutes) {
  const ttl = ttlMinutes || parseInt(process.env.SEAT_HOLD_TTL_MINUTES) || 10;
  const ttlSeconds = ttl * 60;

  // 1. Acquire distributed lock
  const lockValue = await acquireLock(eventId, seatId);
  if (!lockValue) {
    const err = new Error('Seat is currently being reserved by another customer. Please try again.');
    err.status = 409;
    throw err;
  }

  try {
    // 2. DB transaction with row-level lock
    const result = await db.tx(async (t) => {
      // Row-level lock: prevents concurrent reads/writes for this seat
      const seat = await t.oneOrNone(
        `SELECT id, status FROM seat_layout WHERE id = $1 AND event_id = $2 FOR UPDATE`,
        [seatId, eventId]
      );

      if (!seat) {
        const err = new Error('Seat not found for this event');
        err.status = 404;
        throw err;
      }
      if (seat.status !== 'available') {
        const err = new Error(`Seat is not available (current status: ${seat.status})`);
        err.status = 409;
        throw err;
      }

      const holdId = uuidv4();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Update seat status to 'held'
      await t.none(`UPDATE seat_layout SET status = 'held' WHERE id = $1`, [seatId]);

      // Insert hold record
      await t.none(
        `INSERT INTO seat_holds (id, event_id, seat_id, customer_id, hold_expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [holdId, eventId, seatId, customerId, expiresAt]
      );

      return { holdId, expiresAt };
    });

    // 3. Set Redis key with TTL (for fast lookup in real-time seat map)
    await redis.set(
      HOLD_KEY(eventId, seatId),
      JSON.stringify({ holdId: result.holdId, customerId, eventId, seatId, createdAt: new Date() }),
      'EX',
      ttlSeconds
    );

    return result;
  } finally {
    // Always release the lock
    await releaseLock(eventId, seatId, lockValue);
  }
}

/**
 * Release a held seat (on checkout abandonment, hold expiry, or cancellation).
 */
async function releaseSeat(eventId, seatId) {
  // Delete from Redis
  await redis.del(HOLD_KEY(eventId, seatId));

  // DB: delete hold record + reset seat status
  await db.tx(async (t) => {
    await t.none(`DELETE FROM seat_holds WHERE event_id = $1 AND seat_id = $2`, [eventId, seatId]);
    await t.none(`UPDATE seat_layout SET status = 'available' WHERE id = $1 AND status = 'held'`, [seatId]);
  });
}

/**
 * Check if a seat is currently held.
 * If customerId provided, also verifies hold belongs to that customer.
 */
async function isSeatHeld(eventId, seatId, customerId) {
  const raw = await redis.get(HOLD_KEY(eventId, seatId));
  if (!raw) return false;
  if (customerId) {
    const data = JSON.parse(raw);
    return data.customerId === customerId;
  }
  return true;
}

/**
 * Expire stale holds that have passed their TTL.
 * Called by the scheduler every 60 seconds.
 */
async function cleanupExpiredHolds() {
  const expired = await db.any(
    `SELECT sh.event_id, sh.seat_id FROM seat_holds sh
     WHERE sh.hold_expires_at < NOW()`
  );

  let count = 0;
  for (const row of expired) {
    await releaseSeat(row.eventId, row.seatId);
    count++;
  }

  if (count > 0) {
    console.log(`[SeatHold] Released ${count} expired hold(s)`);
  }
  return count;
}

module.exports = { holdSeat, releaseSeat, isSeatHeld, cleanupExpiredHolds };
