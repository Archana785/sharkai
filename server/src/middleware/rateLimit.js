import { AppError } from '../lib/errors.js';

/**
 * Small in-memory limiter. Signed-in requests are counted per account and the rest per IP address, so a whole college
 * sharing one public IP does not use up one common allowance. It stops accidental request loops.
 */
export function rateLimit({ windowMs = 60000, max = 12 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.user?.id || req.ip || req.socket?.remoteAddress || 'unknown';
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    if (recent.length > max) return next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a minute and try again.'));
    next();
  };
}
