require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      console.error('[Redis] Max retries reached. Giving up.');
      return null;
    }
    const delay = Math.min(times * 200, 2000);
    console.warn(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError(err) {
    console.error('[Redis] Reconnect on error:', err.message);
    return true;
  },
});

redis.on('connect', () => console.log('[Redis] Connected successfully'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('close', () => console.warn('[Redis] Connection closed'));

module.exports = redis;
