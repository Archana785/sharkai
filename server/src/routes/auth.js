import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword, verifyAgainstDummy, startSession, endSession } from '../lib/auth.js';
import { addReset, createUser, findUserByEmail, publicUser, takeReset, updateUser, findUserById } from '../lib/store.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = express.Router();
const limiter = rateLimit({ max: config.authRateLimitPerMin });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function invalid(fields) { return new AppError(400, 'INVALID_INPUT', 'Please check the highlighted fields.', fields); }
const cleanEmail = (v) => String(v ?? '').trim().toLowerCase();
const cleanName = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
function checkPassword(pw) {
  const p = String(pw ?? '');
  if (p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'Please keep your password under 128 characters.';
  return null;
}

// GET /api/auth/me -> { user } (user is null when signed out; never an error)
authRouter.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

// POST /api/auth/register { name, email, password }
authRouter.post('/register', limiter, async (req, res, next) => {
  try {
    const name = cleanName(req.body?.name), email = cleanEmail(req.body?.email), password = String(req.body?.password ?? '');
    const fields = {};
    if (name.length < 2 || name.length > 80) fields.name = 'Please enter your full name.';
    if (!EMAIL.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';
    const pwProblem = checkPassword(password);
    if (pwProblem) fields.password = pwProblem;
    if (Object.keys(fields).length) throw invalid(fields);
    if (await findUserByEmail(email)) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.', { email: 'This email is already registered.' });
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    await startSession(res, user, true);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/login { email, password, remember }
authRouter.post('/login', limiter, async (req, res, next) => {
  try {
    const email = cleanEmail(req.body?.email), password = String(req.body?.password ?? '');
    if (!EMAIL.test(email) || !password) throw invalid({ ...(EMAIL.test(email) ? {} : { email: 'Enter a valid email address.' }), ...(password ? {} : { password: 'Enter your password.' }) });
    const user = await findUserByEmail(email);
    const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyAgainstDummy(password), false);
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'That email or password is not correct.');
    await startSession(res, user, req.body?.remember === true);
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => { endSession(res); res.json({ ok: true }); });

// POST /api/auth/forgot { email }: always answers the same way, so it never reveals which emails have accounts.
authRouter.post('/forgot', limiter, async (req, res, next) => {
  try {
    const email = cleanEmail(req.body?.email);
    if (!EMAIL.test(email)) throw invalid({ email: 'Enter a valid email address.' });
    const user = await findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await addReset(user.id, sha256(token), Date.now() + 60 * 60 * 1000);
      // No email service is connected yet, so the link is printed here. Send it by email in production.
      console.log(`[SharkAI] Password reset link for ${email}: ${config.publicUrl}/reset-password?token=${token}`);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/reset { token, password }
authRouter.post('/reset', limiter, async (req, res, next) => {
  try {
    const pwProblem = checkPassword(req.body?.password);
    if (pwProblem) throw invalid({ password: pwProblem });
    const r = await takeReset(sha256(String(req.body?.token ?? '')));
    if (!r) throw new AppError(400, 'INVALID_TOKEN', 'This reset link has expired or was already used. Please request a new one.');
    await updateUser(r.userId, { passwordHash: await hashPassword(req.body.password), pwdAt: Date.now() });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/auth/me { name }
authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const name = cleanName(req.body?.name);
    if (name.length < 2 || name.length > 80) throw invalid({ name: 'Please enter your full name.' });
    res.json({ user: publicUser(await updateUser(req.user.id, { name })) });
  } catch (err) { next(err); }
});

// POST /api/auth/password { current, password }
authRouter.post('/password', requireAuth, limiter, async (req, res, next) => {
  try {
    const pwProblem = checkPassword(req.body?.password);
    if (pwProblem) throw invalid({ password: pwProblem });
    if (!(await verifyPassword(String(req.body?.current ?? ''), req.user.passwordHash))) throw invalid({ current: 'That is not your current password.' });
    await updateUser(req.user.id, { passwordHash: await hashPassword(req.body.password), pwdAt: Date.now() });
    await startSession(res, await findUserById(req.user.id), true); // keep this device signed in; other sessions end
    res.json({ ok: true });
  } catch (err) { next(err); }
});
