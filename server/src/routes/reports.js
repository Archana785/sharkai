import express from 'express';
import { AppError } from '../lib/errors.js';
import { deleteReport, getReport, listReports } from '../lib/store.js';
import { requireAuth } from '../middleware/auth.js';

export const reportsRouter = express.Router();
reportsRouter.use(requireAuth);

// GET /api/reports -> { reports: [{ id, createdAt, idea, overallScore, verdict }] }
reportsRouter.get('/', async (req, res, next) => {
  try {
    const list = await listReports(req.user.id);
    res.json({ reports: list.map((r) => ({ id: r.id, createdAt: r.createdAt, idea: r.idea.slice(0, 200), overallScore: r.result?.overallScore ?? null, verdict: r.result?.verdict ?? '' })) });
  } catch (err) { next(err); }
});

// GET /api/reports/:id -> { report: { id, createdAt, idea, result } }
reportsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getReport(req.user.id, req.params.id);
    if (!r) throw new AppError(404, 'NOT_FOUND', 'That report could not be found.');
    res.json({ report: { id: r.id, createdAt: r.createdAt, idea: r.idea, result: r.result } });
  } catch (err) { next(err); }
});

// DELETE /api/reports/:id
reportsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!(await deleteReport(req.user.id, req.params.id))) throw new AppError(404, 'NOT_FOUND', 'That report could not be found.');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
