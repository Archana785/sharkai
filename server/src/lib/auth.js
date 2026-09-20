// Passwords, session tokens and cookies. Built on Node's crypto only (no extra packages).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../config.js';

const scrypt = promisify(crypto.scrypt);
export const COOKIE = 'sharkai_session';

/** scrypt: a slow, memory-hard hash made for passwords. Each password gets its own random salt. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
// Used when the email is unknown, so "no such user" and "wrong password" take the same time.
let dummy;
export async function verifyAgainstDummy(password) {
  dummy ||= await hashPassword('not-a-real-password');
  return verifyPassword(password, dummy);
}

let secretPromise;
/** AUTH_SECRET from the environment, or a random secret created once and kept in data/.secret. */
export function getSecret() {
  secretPromise ||= (async () => {
    if (config.authSecret) return config.authSecret;
    const f = path.join(config.dataDir, '.secret');
    try { return (await fs.readFile(f, 'utf8')).trim(); } catch { /* create below */ }
    const s = crypto.randomBytes(32).toString('hex');
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.writeFile(f, s, { mode: 0o600 });
    return s;
  })();
  return secretPromise;
}

export async function signToken(payload, ttlSeconds) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export async function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', await getSecret()).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

export function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

const DAY = 24 * 60 * 60;
/** Sets the session cookie. "Remember me" = 30 days; otherwise it ends when the browser closes. */
export async function startSession(res, user, remember) {
  const ttl = remember ? 30 * DAY : DAY;
  const token = await signToken({ sub: user.id, pv: user.pwdAt }, ttl);
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (remember) parts.push(`Max-Age=${ttl}`);
  if (config.cookieSecure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
export function endSession(res) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (config.cookieSecure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
