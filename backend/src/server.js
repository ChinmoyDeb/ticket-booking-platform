require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const { connectDB } = require('./config/db');
const redis = require('./config/redis');
const { startScheduler } = require('./services/scheduler');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const venueRoutes = require('./routes/venues');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const waitlistRoutes = require('./routes/waitlist');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Request ID middleware ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const redisPing = await redis.ping();
    res.json({ status: 'ok', redis: redisPing === 'PONG' ? 'ok' : 'error', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
async function startServer() {
  await connectDB();
  startScheduler();

  const server = app.listen(PORT, () => {
    console.log(`[Server] TicketHub API running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await redis.quit();
      console.log('[Server] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
