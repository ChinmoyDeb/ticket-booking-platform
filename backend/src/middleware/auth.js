const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

/**
 * Middleware: verify JWT token from Authorization header.
 * Attaches `req.user` on success.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required', timestamp: new Date().toISOString() });
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user to ensure account still exists / not deleted
    const user = await db.oneOrNone(
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
      [payload.id]
    );
    if (!user) {
      return res.status(401).json({ error: 'User not found or account deactivated', timestamp: new Date().toISOString() });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', timestamp: new Date().toISOString() });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', timestamp: new Date().toISOString() });
    }
    next(err);
  }
}

/**
 * Middleware factory: restrict access to specific roles.
 * @param {...string} roles - Allowed roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', timestamp: new Date().toISOString() });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
