// One entry point for "ask the AI". Providers are tried in the order of AI_PROVIDER (for example "groq,gemini,ollama"):
// if one is out of free quota, unreachable or fails, the next one answers, so the site keeps working.
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { ollamaChat, ollamaHealth } from './ollama.js';

/** A JSON outline built from the schema. JSON mode guarantees valid JSON, not the right keys, so we show the keys. */
function outline(schema) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return '';
    if (n.type === 'object') return Object.fromEntries(Object.entries(n.properties || {}).map(([k, v]) => [k, walk(v)]));
    if (n.type === 'array') return [walk(n.items)];
    return n.type === 'integer' || n.type === 'number' ? 0 : '';
  };
  return JSON.stringify(walk(schema));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(p, model, body, signal) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, config.aiTimeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal) signal.aborted ? ctrl.abort() : signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ ...body, model }),
      signal: ctrl.signal
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep the text */ }
    return { res, json, text };
  } catch (err) {
    if (timedOut) throw new AppError(504, 'TIMEOUT', 'The AI took too long to answer.');
    if (err?.name === 'AbortError') throw err; // the user cancelled
    throw new AppError(503, 'AI_UNAVAILABLE', `Cannot reach the AI service at ${p.baseUrl}.`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Providers retire and rename models. If a configured model is "not found", ask the provider which models THIS key
 * can use and pick the best ordinary chat model, so a renamed model never breaks the site.
 */
const PREFERRED = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'openai/gpt-oss-120b', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const NOT_CHAT = /whisper|tts|guard|embed|orpheus|safeguard|compound|moderation|transcri|speech|image/i;
const WEAK = /allam/i; // an Arabic-focused model: only used when nothing else exists
/** "Reasoning" models think silently before answering. That thinking uses up the answer budget, so they need extra room. */
const REASONING = /gpt-oss|qwen3|deepseek|kimi|r1|reason|thinking/i;
const found = new Map();
function discoverModels(p) {
  if (!found.has(p.name)) {
    found.set(p.name, (async () => {
      try {
        const res = await fetch(`${p.baseUrl}/models`, { headers: { Authorization: `Bearer ${p.apiKey}` }, signal: AbortSignal.timeout(10000) });
        const list = ((await res.json())?.data || []).map((m) => m.id).filter((id) => typeof id === 'string' && !NOT_CHAT.test(id));
        const rank = (id) => { const i = PREFERRED.indexOf(id); return i >= 0 ? i : WEAK.test(id) ? 500 : 100; };
        return list.sort((a, b) => rank(a) - rank(b));
      } catch { return []; }
    })());
  }
  return found.get(p.name);
}
const modelMissing = (res, json) => {
  const m = String(json?.error?.message || '');
  return res.status === 404 || (res.status === 400 && /model/i.test(m) && /(does not exist|not exist|not found|decommission|do not have access|no access)/i.test(m));
};

/** Ask one hosted provider. Retries briefly on a rate limit, then tries that provider's smaller model. */
async function cloudChat(p, { system, user, format, temperature = 0.4, numPredict, signal }) {
  const body = {
    messages: [
      { role: 'system', content: format ? `${system}\n\nReturn exactly this JSON shape, with every key filled in:\n${outline(format)}` : system },
      { role: 'user', content: user }
    ],
    temperature,
    ...(numPredict ? { max_tokens: numPredict } : {}),
    ...(format ? { response_format: { type: 'json_object' } } : {})
  };

  // Reasoning models (gpt-oss, qwen3...) spend part of max_tokens on hidden thinking, so they get more room and,
  // where the provider supports it, a "low" thinking effort. If the provider refuses that setting we retry without it.
  const bodyFor = (model, plain, noJson) => {
    const b = REASONING.test(model)
      ? { ...body, max_tokens: Math.max(body.max_tokens || 0, 5000), ...(!plain && /gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}) }
      : { ...body };
    if (noJson) delete b.response_format;
    return b;
  };
  let last;
  p.dead ||= new Set(); // models this key cannot use
  let queue = p.models.filter((m) => !p.dead.has(m));
  if (!queue.length) { p.dead.clear(); queue = [...p.models]; } // start fresh rather than get stuck
  const tried = new Set();
  let asked = false;
  while (queue.length) {
    const model = queue.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    let plain = false;
    let noJson = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { res, json, text } = await post(p, model, bodyFor(model, plain, noJson), signal);
      if (res.ok) {
        // some models put their thinking inside <think> tags; the user should only see the answer
        const content = String(json?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (content) {
          p.lastModel = model;
          if (!p.models.includes(model)) p.models = [model, ...p.models]; // a model found by asking the provider: remember it
          return content;
        }
        throw new AppError(502, 'BAD_MODEL_OUTPUT', 'The AI returned an empty answer.');
      }
      const msg = String(json?.error?.message || text || res.status).slice(0, 300);
      if (res.status === 401 || res.status === 403) throw new AppError(503, 'AI_AUTH', `${p.name} rejected the API key.`);
      if (res.status === 400 && !noJson && body.response_format && /response_format|json/i.test(msg) && !modelMissing(res, json)) { noJson = true; continue; }
      if (res.status === 400 && !plain && REASONING.test(model) && /reasoning|unsupported|not support|unknown|invalid/i.test(msg) && !modelMissing(res, json)) { plain = true; continue; }
      if (modelMissing(res, json)) {
        p.dead.add(model);
        last = new AppError(502, 'AI_ERROR', `${p.name}: model "${model}" is not available (${msg})`);
        if (!asked) { // ask the provider what this key can use, once
          asked = true;
          for (const id of (await discoverModels(p)).slice(0, 3)) if (!tried.has(id) && !queue.includes(id)) queue.push(id);
        }
        break;
      }
      if (res.status === 429) {
        last = new AppError(503, 'AI_BUSY', `${p.name} is at its free limit right now.`);
        const after = Number(res.headers.get('retry-after'));
        if (attempt < 2 && after > 0 && after <= 15) { await wait(after * 1000); continue; } // a short wait is worth it
        break; // long wait or daily limit: try the smaller model instead
      }
      if (res.status >= 500 && attempt < 2) { await wait(1000); continue; }
      last = new AppError(502, 'AI_ERROR', `${p.name} returned an error: ${msg}`);
      break;
    }
  }
  throw last || new AppError(502, 'AI_ERROR', `${p.name} did not answer.`);
}

// Problems that mean "try the next provider". Anything else (like the user cancelling) stops right away.
const FAILOVER = new Set(['AI_BUSY', 'AI_UNAVAILABLE', 'AI_AUTH', 'AI_ERROR', 'TIMEOUT', 'BAD_MODEL_OUTPUT', 'OLLAMA_DOWN', 'MODEL_MISSING', 'OLLAMA_ERROR']);

/** Same call for every provider: returns the model's text. */
export async function llmChat(args) {
  if (!config.providers.length) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'No AI is set up on the server. Add GROQ_API_KEY to the server settings and restart it.');
  }
  let last;
  for (const p of config.providers) {
    try {
      return p.kind === 'ollama' ? await ollamaChat(args) : await cloudChat(p, args);
    } catch (err) {
      if (err?.name === 'AbortError' || !(err instanceof AppError) || !FAILOVER.has(err.code)) throw err;
      console.warn(`[SharkAI] ${p.name} could not answer (${err.code}: ${err.message})${p === config.providers.at(-1) ? '' : ' - trying the next one'}`);
      last = err;
    }
  }
  throw last;
}

export const usesCloud = () => config.providers.some((p) => p.kind === 'cloud');

/** For GET /api/health and the startup message. Never spends any free quota. */
export async function llmHealth() {
  const only = config.providers[0];
  if (!only) return { ok: false, provider: null, model: null, keyConfigured: false, chain: [], problem: 'No AI is set up. Add GROQ_API_KEY to the server settings.' };
  if (config.providers.length === 1 && only.kind === 'ollama') return ollamaHealth();
  return {
    ok: true,
    provider: only.name,
    model: only.models[0],
    fallbackModel: only.models[1] || null,
    keyConfigured: only.kind === 'ollama' ? true : !!only.apiKey,
    chain: config.providers.map((p) => `${p.name} (${p.models.join(' > ')})`)
  };
}

/**
 * A real (tiny) test of every provider: about 20 tokens each. Open /api/health?check=1 after hosting to see
 * "groq: ok" instead of finding a wrong key in the middle of a presentation. Keys are never shown.
 */
export async function llmCheck() {
  const results = [];
  if (!config.providers.length) return { ok: false, results, problem: 'No AI is set up. Add GROQ_API_KEY to the server settings and restart the server.' };
  for (const p of config.providers) {
    if (p.kind === 'ollama') {
      const h = await ollamaHealth();
      const ok = h.ollama === 'up' && h.modelInstalled;
      results.push({ provider: 'ollama', model: h.model, ok, ...(ok ? {} : { problem: h.ollama === 'down' ? 'Ollama is not running.' : 'The model is not installed.' }) });
      continue;
    }
    const wanted = p.models.find((m) => !p.dead?.has(m)) || p.models[0];
    const started = Date.now();
    try {
      await cloudChat(p, { system: 'Reply with the single word: ok', user: 'ok', temperature: 0, numPredict: 5 });
      const model = p.lastModel;
      results.push({ provider: p.name, model, ok: true, ms: Date.now() - started, ...(model !== wanted ? { note: `"${wanted}" is not available to your key, so "${model}" is used instead.` } : {}) });
    } catch (err) {
      results.push({
        provider: p.name, model: wanted, ok: false, code: err.code,
        problem: err.code === 'AI_AUTH' ? 'The API key was rejected. Check that it was copied exactly.'
          : err.code === 'AI_BUSY' ? 'The free limit is reached right now (the site will use the smaller model or the next provider).'
          : String(err.message || 'It did not answer.').slice(0, 220)
      });
    }
  }
  return { ok: results.some((r) => r.ok), results };
}