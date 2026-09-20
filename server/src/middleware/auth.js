import { AppError } from '../lib/errors.js';
import { COOKIE, parseCookies, verifyToken } from '../lib/auth.js';
import { findUserById } from '../lib/store.js';

/** Reads the session cookie and, when valid, puts the user on req.user. Never rejects by itself. */
export async function attachUser(req, _res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    const payload = token ? await verifyToken(token) : null;
    const user = payload ? await findUserById(payload.sub) : null;
    // a password change or reset invalidates every older session
    req.user = user && user.pwdAt === payload.pv ? user : null;
    next();
  } catch (err) { next(err); }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
  next();
}
