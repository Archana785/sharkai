// A tiny JSON-file database (users, saved reports, password-reset tokens). Used when DATABASE_URL is not set
// (local development and the tests). Free hosts wipe their disk on every redeploy, so a hosted site uses store-pg.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { hashPassword, verifyPassword } from './auth.js';

let db = null;
let ready = null;
let queue = Promise.resolve();
const file = () => path.join(config.dataDir, 'db.json');

function init() {
  if (!ready) {
    ready = (async () => {
      await fs.mkdir(config.dataDir, { recursive: true });
      try { db = JSON.parse(await fs.readFile(file(), 'utf8')); } catch { db = {}; }
      db.users ||= []; db.reports ||= []; db.resets ||= []; db.cache ||= {};
      await seedDemoUser();
    })();
  }
  return ready;
}

/**
 * The demo account has a fixed id and password version, so a session cookie from before a restart still works after it,
 * even when the host wiped the disk in between.
 */
async function seedDemoUser() {
  const { demoEmail: email, demoPassword: password, demoName: name } = config;
  if (!email || !password) return;
  const uid = crypto.createHash('sha256').update(`demo:${email}`).digest('hex').slice(0, 32);
  let u = db.users.find((x) => x.email === email);
  if (!u) {
    u = { id: uid, name, email, passwordHash: await hashPassword(password), pwdAt: 1, createdAt: new Date().toISOString() };
    db.users.push(u);
  } else if (!(await verifyPassword(password, u.passwordHash))) {
    u.passwordHash = await hashPassword(password); // the DEMO_PASSWORD setting changed
    u.pwdAt = 1;
  }
  await save();
}

// Writes are queued and atomic (write a temp file, then rename), so a crash never leaves half a file.
function save() {
  queue = queue.then(async () => {
    const tmp = `${file()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db));
    await fs.rename(tmp, file());
  }).catch((err) => console.error('Could not save data:', err.message));
  return queue;
}

const id = () => crypto.randomUUID();
export { init as initStore };

export async function findUserByEmail(email) { await init(); return db.users.find((u) => u.email === email) || null; }
export async function findUserById(uid) { await init(); return db.users.find((u) => u.id === uid) || null; }
export async function createUser({ name, email, passwordHash }) {
  await init();
  const user = { id: id(), name, email, passwordHash, pwdAt: Date.now(), createdAt: new Date().toISOString() };
  db.users.push(user);
  await save();
  return user;
}
export async function updateUser(uid, patch) {
  await init();
  const u = db.users.find((x) => x.id === uid);
  if (!u) return null;
  Object.assign(u, patch);
  await save();
  return u;
}

const MAX_REPORTS = 100;
export async function addReport(userId, { idea, result }) {
  await init();
  const report = { id: id(), userId, createdAt: new Date().toISOString(), idea, result };
  db.reports.push(report);
  const mine = db.reports.filter((r) => r.userId === userId);
  if (mine.length > MAX_REPORTS) {
    const drop = new Set(mine.slice(0, mine.length - MAX_REPORTS).map((r) => r.id));
    db.reports = db.reports.filter((r) => !drop.has(r.id));
  }
  await save();
  return report;
}
export async function listReports(userId) {
  await init();
  return db.reports.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getReport(userId, rid) { await init(); return db.reports.find((r) => r.id === rid && r.userId === userId) || null; }
export async function deleteReport(userId, rid) {
  await init();
  const before = db.reports.length;
  db.reports = db.reports.filter((r) => !(r.id === rid && r.userId === userId));
  if (db.reports.length !== before) await save();
  return db.reports.length !== before;
}

export async function addReset(userId, tokenHash, expires) {
  await init();
  db.resets = db.resets.filter((r) => r.expires > Date.now() && r.userId !== userId);
  db.resets.push({ userId, tokenHash, expires });
  await save();
}
export async function takeReset(tokenHash) {
  await init();
  const r = db.resets.find((x) => x.tokenHash === tokenHash && x.expires > Date.now());
  if (!r) return null;
  db.resets = db.resets.filter((x) => x.userId !== r.userId);
  await save();
  return r;
}

// The same idea always gives the same report, so a repeat costs no AI tokens and appears instantly.
const CACHE_DAYS = 7;
const CACHE_MAX = 300;
export async function getCached(key) {
  await init();
  const hit = db.cache[key];
  if (!hit || Date.now() - hit.at > CACHE_DAYS * 86400000) return null;
  return JSON.parse(JSON.stringify(hit.value));
}
export async function setCached(key, value) {
  await init();
  db.cache[key] = { at: Date.now(), value };
  const keys = Object.keys(db.cache);
  if (keys.length > CACHE_MAX) {
    keys.sort((a, b) => db.cache[a].at - db.cache[b].at).slice(0, keys.length - CACHE_MAX).forEach((k) => delete db.cache[k]);
  }
  await save();
}
