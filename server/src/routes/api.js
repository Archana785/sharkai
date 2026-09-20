import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { extractText } from '../lib/extract.js';
import { evaluateIdea, generatePitch } from '../services/evaluate.js';
import { expandRoadmap } from '../services/roadmap.js';
import { llmCheck, llmHealth } from '../services/llm.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { addReport, getCached, listReports, setCached } from '../lib/store.js';
import { EVALUATE_SYSTEM } from '../prompts/evaluate.js';

export const api = express.Router();

const limiter = rateLimit({ max: config.rateLimitPerMin });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

/** An AbortSignal that fires if the browser goes away (Cancel, closed tab), so we stop the model too. */
function abortOnDisconnect(res) {
  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  return ctrl.signal;
}

function readIdea(body) {
  const idea = String(body?.idea ?? '').trim();
  if (idea.length < config.minIdeaChars) throw new AppError(400, 'IDEA_TOO_SHORT', 'Please write a sentence or two about your idea first.');
  if (idea.length > config.maxIdeaChars) throw new AppError(400, 'IDEA_TOO_LONG', `Please keep your idea under ${config.maxIdeaChars} characters.`);
  return idea;
}
// Same idea (ignoring capitals and extra spaces) + same instructions = same report. Changing the prompt clears old entries.
const ideaKey = (idea) => crypto.createHash('sha256').update(`v3\n${EVALUATE_SYSTEM}\n${idea.toLowerCase().replace(/\s+/g, ' ').trim()}`).digest('hex');
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 3).map((s) => s.slice(0, 300)) : []);

// GET /api/health -> Ollama: { ok, ollama: "up" | "down", model, modelInstalled }  |  hosted AI: { ok, provider, model, keyConfigured }
// GET /api/health?check=1 -> really asks each AI provider a tiny question (about 20 tokens) and says which ones work
const checkLimiter = rateLimit({ max: 6 });
api.get('/health', (req, res, next) => (req.query.check ? checkLimiter(req, res, next) : next()), async (req, res, next) => {
  try { res.json(req.query.check ? await llmCheck() : await llmHealth()); } catch (err) { next(err); }
});

// POST /api/evaluate { idea } (signed in) -> { reportId, overallScore, verdict, strengths, improvements, evaluation, roadmap, pitch }
api.post('/evaluate', requireAuth, limiter, async (req, res, next) => {
  try {
    const idea = readIdea(req.body);
    const key = ideaKey(idea);
    let result = await getCached(key); // a repeat costs nothing and appears instantly
    if (!result) {
      // keeps a free AI quota from being used up by one account
      if (config.maxEvalsPerDay > 0) {
        const since = new Date(); since.setUTCHours(0, 0, 0, 0);
        const today = (await listReports(req.user.id)).filter((r) => r.createdAt >= since.toISOString()).length;
        if (today >= config.maxEvalsPerDay) throw new AppError(429, 'DAILY_LIMIT', `You have used today's ${config.maxEvalsPerDay} evaluations. Please come back tomorrow.`);
      }
      result = await evaluateIdea(idea, abortOnDisconnect(res));
      await setCached(key, result);
    }
    const saved = await addReport(req.user.id, { idea, result }); // shows up under "Saved Reports"
    res.json({ ...result, reportId: saved.id });
  } catch (err) { next(err); }
});

// POST /api/pitch { idea, strengths?, improvements?, variant? } -> { pitch }
api.post('/pitch', requireAuth, limiter, async (req, res, next) => {
  try {
    const idea = readIdea(req.body);
    const pitch = await generatePitch(
      { idea, strengths: strings(req.body?.strengths), improvements: strings(req.body?.improvements), variant: Number(req.body?.variant) || 0 },
      abortOnDisconnect(res)
    );
    res.json({ pitch });
  } catch (err) { next(err); }
});

// POST /api/roadmap { idea, steps: [four strings] } -> { roadmap: [four full paragraphs] }  (upgrades an older report's short steps)
api.post('/roadmap', requireAuth, limiter, async (req, res, next) => {
  try {
    const idea = readIdea(req.body);
    const steps = Array.isArray(req.body?.steps) ? req.body.steps.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.slice(0, 1000)) : [];
    if (steps.length !== 4) throw new AppError(400, 'BAD_REQUEST', 'Four steps are needed.');
    res.json({ roadmap: await expandRoadmap({ idea, steps }, abortOnDisconnect(res)) });
  } catch (err) { next(err); }
});

// POST /api/extract (multipart, field "file") -> { text, truncated }
api.post('/extract', requireAuth, limiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'NO_FILE', 'No file was received.');
    const raw = await extractText(req.file.buffer, req.file.originalname || '');
    const clean = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) throw new AppError(422, 'EMPTY_FILE', 'No readable text was found in that file. If it only contains images, paste the text instead.');
    res.json({ text: clean.slice(0, config.maxIdeaChars), truncated: clean.length > config.maxIdeaChars });
  } catch (err) { next(err); }
});

api.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Unknown API endpoint.')));