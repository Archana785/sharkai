import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { reportsRouter } from './routes/reports.js';
import { attachUser } from './middleware/auth.js';
import { AppError } from './lib/errors.js';
import { config } from './config.js';

/** Every error leaves the API in the same shape: { error: { code, message } }. */
function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err?.name === 'AbortError') return res.end(); // the browser cancelled; nobody is listening
  let e = err;
  if (!(e instanceof AppError)) {
    if (e?.code === 'LIMIT_FILE_SIZE') e = new AppError(413, 'FILE_TOO_LARGE', 'That file is too large (8 MB maximum).');
    else if (e?.type === 'entity.too.large') e = new AppError(413, 'IDEA_TOO_LONG', 'That is too much text. Please shorten it.');
    else if (e?.type === 'entity.parse.failed') e = new AppError(400, 'BAD_REQUEST', 'The request was not valid JSON.');
    else {
      console.error('Unexpected error:', err);
      e = new AppError(500, 'INTERNAL', 'Something went wrong on our side. Please try again.');
    }
  }
  if (e.status >= 500) console.warn(`[SharkAI] request failed: ${e.code}: ${e.message}`);
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } });
}

export function createApp({ clientDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', attachUser);
  app.use('/api/auth', authRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api', api);

  // Production: serve the built React app; client-side routes fall back to index.html.
  const dist = clientDist || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
