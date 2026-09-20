import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

/** Combine the caller's abort signal (user cancelled / closed the tab) with our own timeout. */
function withAbort(signal, timeoutMs) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal) signal.aborted ? ctrl.abort() : signal.addEventListener('abort', onAbort, { once: true });
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    done() { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  };
}

async function call(path, { method = 'GET', body, signal, timeoutMs = config.timeoutMs } = {}) {
  const ab = withAbort(signal, timeoutMs);
  const timeoutError = () => new AppError(504, 'TIMEOUT',
    'The AI took too long to answer. Try a shorter description, or set a smaller/faster model in server/.env (see the README).');
  try {
    let res;
    try {
      res = await fetch(config.ollamaHost + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ab.signal
      });
    } catch (err) {
      if (ab.timedOut()) throw timeoutError();
      if (err?.name === 'AbortError') throw err; // the user cancelled: routes end the response quietly
      throw new AppError(503, 'OLLAMA_DOWN', `SharkAI cannot reach Ollama at ${config.ollamaHost}. Make sure Ollama is running.`);
    }
    let text;
    try {
      text = await res.text();
    } catch (err) {
      if (ab.timedOut()) throw timeoutError();
      throw err?.name === 'AbortError' ? err : new AppError(502, 'OLLAMA_ERROR', 'The connection to Ollama was interrupted. Please try again.');
    }
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON: keep the text for the message */ }
    if (!res.ok) {
      const msg = String(json?.error || text || res.status).slice(0, 300);
      if (res.status === 404 && /model/i.test(msg)) {
        throw new AppError(503, 'MODEL_MISSING', `The model "${config.model}" is not installed. In a terminal, run: ollama pull ${config.model}`);
      }
      if (res.status === 400 && /format|schema/i.test(msg)) throw Object.assign(new Error(msg), { formatUnsupported: true });
      throw new AppError(502, 'OLLAMA_ERROR', `Ollama returned an error: ${msg}`);
    }
    return json;
  } finally {
    ab.done();
  }
}

/**
 * One chat turn. `format` is a JSON Schema: Ollama then constrains its output to that shape (structured outputs).
 * Older Ollama versions only know format:"json", so we retry once in that mode if the schema is rejected.
 * Returns the assistant's text.
 */
export async function ollamaChat({ system, user, format, temperature = 0.4, numPredict, signal }) {
  const send = (fmt) => call('/api/chat', {
    method: 'POST',
    signal,
    body: {
      model: config.model,
      stream: false,
      ...(fmt ? { format: fmt } : {}),
      keep_alive: config.keepAlive,
      options: { temperature, top_p: 0.9, num_ctx: config.numCtx, ...(numPredict ? { num_predict: numPredict } : {}) },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    }
  });
  let data;
  try {
    data = await send(format);
  } catch (err) {
    if (err.formatUnsupported && format && typeof format === 'object') data = await send('json');
    else if (err.formatUnsupported) throw new AppError(502, 'OLLAMA_ERROR', `Ollama returned an error: ${err.message}`);
    else throw err;
  }
  const content = data?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AppError(502, 'BAD_MODEL_OUTPUT', 'The AI returned an empty answer. Please try again.');
  return content;
}

/** Is Ollama reachable, and is the configured model installed? Never throws. */
export async function ollamaHealth() {
  try {
    const data = await call('/api/tags', { timeoutMs: 4000 });
    const names = (data?.models || []).map((m) => m.name);
    const base = config.model.split(':')[0];
    const installed = names.some((n) => n === config.model || (!config.model.includes(':') && n.split(':')[0] === base));
    return { ok: true, ollama: 'up', model: config.model, modelInstalled: installed };
  } catch {
    return { ok: true, ollama: 'down', model: config.model, modelInstalled: false };
  }
}
