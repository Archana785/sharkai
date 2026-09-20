// Users, saved reports, password-reset tokens and the result cache.
// DATABASE_URL set   -> Postgres (Supabase), which survives redeploys  (store-pg.js)
// DATABASE_URL empty -> a JSON file in server/data, fine for local use  (store-file.js)
import { config } from '../config.js';

const backend = config.databaseUrl ? await import('./store-pg.js') : await import('./store-file.js');

export const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

export const {
  initStore, findUserByEmail, findUserById, createUser, updateUser,
  addReport, listReports, getReport, deleteReport,
  addReset, takeReset, getCached, setCached
} = backend;
