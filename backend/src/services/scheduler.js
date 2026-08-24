const cron = require('node-cron');
const { cleanupExpiredHolds } = require('./seatHoldService');
const { processExpiredOffers } = require('./waitlistService');
const { cleanupOldQRCodes } = require('./qrService');

/**
 * Start all background scheduler jobs.
 * Called once from server.js on startup.
 */
function startScheduler() {
  // ── Every 60 seconds: release expired seat holds ──────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      await cleanupExpiredHolds();
    } catch (err) {
      console.error('[Scheduler] Hold cleanup error:', err.message);
    }
  });

  // ── Every 60 seconds: advance waitlist for expired offers ─────────────────
  cron.schedule('* * * * *', async () => {
    try {
      await processExpiredOffers();
    } catch (err) {
      console.error('[Scheduler] Waitlist offer cleanup error:', err.message);
    }
  });

  // ── Daily at 3am: delete QR codes older than 90 days ──────────────────────
  cron.schedule('0 3 * * *', () => {
    cleanupOldQRCodes();
  });

  console.log('[Scheduler] All cron jobs started');
}

module.exports = { startScheduler };
