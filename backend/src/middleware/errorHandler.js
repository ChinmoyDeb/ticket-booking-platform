/**
 * Centralized error handling middleware.
 * Returns a consistent { error, timestamp, requestId } JSON response.
 */
function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  const requestId = req.requestId || 'unknown';

  // Log all errors with context
  console.error(`[Error] ${timestamp} | RequestId: ${requestId} | ${err.name || 'Error'}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // pg-promise specific: unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists', timestamp, requestId });
  }

  // pg-promise: foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found', timestamp, requestId });
  }

  // JWT errors (should be caught in middleware, but just in case)
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', timestamp, requestId });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token', timestamp, requestId });
  }

  // Validation errors from express-validator (or manually thrown)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, timestamp, requestId });
  }

  // Default: internal server error
  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  res.status(500).json({ error: message, timestamp, requestId });
}

/**
 * 404 handler for undefined routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { errorHandler, notFoundHandler };
