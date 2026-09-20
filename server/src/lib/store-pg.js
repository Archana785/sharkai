// Postgres storage (Supabase, or any Postgres), used when DATABASE_URL is set. Same functions as store-file.js.
// Tables live in their own "sharkai" schema and are created on first start, so there is no SQL to run by hand.
import crypto from 'node:crypto';
import pg from 'pg';
import { config } from '../config.js';
import { hashPassword, verifyPassword } from './auth.js';

let pool = null;
let ready = null;

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined, // Supabase requires TLS
      max: 5, // free Supabase poolers allow few connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    // Without this, a dropped idle connection would crash the whole server.
    pool.on('error', (err) => console.warn('[SharkAI] database connection error:', err.message));
  }
  return pool;
}
const query = (text, params) => getPool().query(text, params);

const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS sharkai;
CREATE TABLE IF NOT EXISTS sharkai.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  pwd_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sharkai.reports (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES sharkai.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  idea text NOT NULL,
  result jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_user_created ON sharkai.reports (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS sharkai.resets (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES sharkai.users(id) ON DELETE CASCADE,
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sharkai.cache (
  key text PRIMARY KEY,
  at bigint NOT NULL,
  value jsonb NOT NULL
);
-- Supabase can serve tables through its public REST API. Row level security with no policies blocks that route;
-- this server connects as the database owner, which is not affected.
ALTER TABLE sharkai.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkai.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkai.resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkai.cache ENABLE ROW LEVEL SECURITY;
`;

export function initStore() {
  if (!ready) {
    ready = (async () => {
      await query(SCHEMA);
      await seedDemoUser();
    })().catch((err) => { ready = null; throw err; }); // try again on the next request instead of failing forever
  }
  return ready;
}

// Rows use snake_case and Date objects; the rest of the server expects the shapes store-file.js returns.
const toUser = (r) => (r ? {
  id: r.id, name: r.name, email: r.email, passwordHash: r.password_hash,
  pwdAt: Number(r.pwd_at), // bigint arrives as a string; sessions compare it with ===
  createdAt: r.created_at.toISOString()
} : null);
const toReport = (r) => ({ id: r.id, userId: r.user_id, createdAt: r.created_at.toISOString(), idea: r.idea, result: r.result });

/** Same fixed id and password version as store-file.js, so a demo session cookie survives restarts. */
async function seedDemoUser() {
  const { demoEmail: email, demoPassword: password, demoName: name } = config;
  if (!email || !password) return;
  const uid = crypto.createHash('sha256').update(`demo:${email}`).digest('hex').slice(0, 32);
  const { rows } = await query('SELECT * FROM sharkai.users WHERE email = $1', [email]);
  if (!rows[0]) {
    await query(
      'INSERT INTO sharkai.users (id, name, email, password_hash, pwd_at) VALUES ($1, $2, $3, $4, 1) ON CONFLICT DO NOTHING',
      [uid, name, email, await hashPassword(password)]
    );
  } else if (!(await verifyPassword(password, rows[0].password_hash))) {
    await query('UPDATE sharkai.users SET password_hash = $1, pwd_at = 1 WHERE id = $2', [await hashPassword(password), rows[0].id]); // DEMO_PASSWORD changed
  }
}

export async function findUserByEmail(email) {
  await initStore();
  return toUser((await query('SELECT * FROM sharkai.users WHERE email = $1', [email])).rows[0]);
}
export async function findUserById(uid) {
  await initStore();
  return toUser((await query('SELECT * FROM sharkai.users WHERE id = $1', [uid])).rows[0]);
}
export async function createUser({ name, email, passwordHash }) {
  await initStore();
  const { rows } = await query(
    'INSERT INTO sharkai.users (id, name, email, password_hash, pwd_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [crypto.randomUUID(), name, email, passwordHash, Date.now()]
  );
  return toUser(rows[0]);
}

const USER_COLUMNS = { name: 'name', passwordHash: 'password_hash', pwdAt: 'pwd_at' }; // the only fields the app ever changes
export async function updateUser(uid, patch) {
  await initStore();
  const keys = Object.keys(patch).filter((k) => USER_COLUMNS[k]);
  if (!keys.length) return findUserById(uid);
  const sets = keys.map((k, i) => `${USER_COLUMNS[k]} = $${i + 2}`).join(', ');
  const { rows } = await query(`UPDATE sharkai.users SET ${sets} WHERE id = $1 RETURNING *`, [uid, ...keys.map((k) => patch[k])]);
  return toUser(rows[0]);
}

const MAX_REPORTS = 100;
export async function addReport(userId, { idea, result }) {
  await initStore();
  const { rows } = await query(
    'INSERT INTO sharkai.reports (id, user_id, idea, result) VALUES ($1, $2, $3, $4) RETURNING *',
    [crypto.randomUUID(), userId, idea, JSON.stringify(result)]
  );
  await query(
    'DELETE FROM sharkai.reports WHERE user_id = $1 AND id IN (SELECT id FROM sharkai.reports WHERE user_id = $1 ORDER BY created_at DESC OFFSET $2)',
    [userId, MAX_REPORTS]
  );
  return toReport(rows[0]);
}
export async function listReports(userId) {
  await initStore();
  return (await query('SELECT * FROM sharkai.reports WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows.map(toReport);
}
export async function getReport(userId, rid) {
  await initStore();
  const { rows } = await query('SELECT * FROM sharkai.reports WHERE id = $1 AND user_id = $2', [rid, userId]);
  return rows[0] ? toReport(rows[0]) : null;
}
export async function deleteReport(userId, rid) {
  await initStore();
  return (await query('DELETE FROM sharkai.reports WHERE id = $1 AND user_id = $2', [rid, userId])).rowCount > 0;
}

export async function addReset(userId, tokenHash, expires) {
  await initStore();
  await query('DELETE FROM sharkai.resets WHERE expires <= $1 OR user_id = $2', [Date.now(), userId]);
  await query('INSERT INTO sharkai.resets (token_hash, user_id, expires) VALUES ($1, $2, $3)', [tokenHash, userId, expires]);
}
export async function takeReset(tokenHash) {
  await initStore();
  // one atomic DELETE ... RETURNING, so a link can never be used twice even with two requests at once
  const { rows } = await query('DELETE FROM sharkai.resets WHERE token_hash = $1 AND expires > $2 RETURNING user_id, expires', [tokenHash, Date.now()]);
  if (!rows[0]) return null;
  await query('DELETE FROM sharkai.resets WHERE user_id = $1', [rows[0].user_id]);
  return { userId: rows[0].user_id, tokenHash, expires: Number(rows[0].expires) };
}

// The same idea always gives the same report, so a repeat costs no AI tokens and appears instantly.
const CACHE_DAYS = 7;
const CACHE_MAX = 300;
export async function getCached(key) {
  await initStore();
  const { rows } = await query('SELECT value, at FROM sharkai.cache WHERE key = $1', [key]);
  if (!rows[0] || Date.now() - Number(rows[0].at) > CACHE_DAYS * 86400000) return null;
  return rows[0].value;
}
export async function setCached(key, value) {
  await initStore();
  await query(
    'INSERT INTO sharkai.cache (key, at, value) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at, value = EXCLUDED.value',
    [key, Date.now(), JSON.stringify(value)]
  );
  await query('DELETE FROM sharkai.cache WHERE key IN (SELECT key FROM sharkai.cache ORDER BY at DESC OFFSET $1)', [CACHE_MAX]);
}
