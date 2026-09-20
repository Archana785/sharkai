import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Reads server/.env when it exists (copy .env.example). Real environment variables always win.
dotenv.config({ path: new URL('../.env', import.meta.url) });

// Hosted AI providers that speak the OpenAI "chat completions" format.
const PRESETS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', fallback: 'llama-3.1-8b-instant' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', fallback: 'gemini-flash-lite-latest' }
};

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * AI_PROVIDER is an ordered list, for example "groq,gemini,ollama". The first one that works answers.
 * If one is out of free quota, down, or offline, the next one takes over automatically.
 * Each hosted provider reads its own key: GROQ_API_KEY, GEMINI_API_KEY (AI_API_KEY also works for the first one).
 */
const env = process.env;
const pick = (name, suffix, first) => env[`${name.toUpperCase()}_${suffix}`] ?? (first ? env[`AI_${suffix}`] : undefined);
const wanted = (env.AI_PROVIDER || 'groq,gemini').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const all = wanted.map((name, i) => {
  if (name === 'ollama') return { name, kind: 'ollama', models: [env.OLLAMA_MODEL || 'llama3.1:8b'] };
  const preset = PRESETS[name] || {};
  const first = i === 0;
  const models = [pick(name, 'MODEL', first) || preset.model, pick(name, 'FALLBACK_MODEL', first) ?? preset.fallback]
    .filter((m, k, arr) => m && arr.indexOf(m) === k);
  return { name, kind: 'cloud', apiKey: pick(name, 'API_KEY', first) || '', baseUrl: String(pick(name, 'BASE_URL', first) || preset.baseUrl || '').replace(/\/+$/, ''), models };
});
const providers = all.filter((p) => p.kind === 'ollama' || p.apiKey);
const skippedProviders = all.filter((p) => !providers.includes(p)).map((p) => p.name); // named but no key set
// Ollama (an AI on your own computer) is used ONLY when "ollama" is written in AI_PROVIDER. It is never a silent fallback,
// so a hosted site can never end up waiting for an Ollama that does not exist.

export const config = {
  port: num(process.env.PORT, 8787),
  ollamaHost: (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
  // Local models can be slow, especially on CPU, so the default allows 5 minutes.
  timeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 300000),
  numCtx: num(process.env.OLLAMA_NUM_CTX, 8192),
  keepAlive: process.env.OLLAMA_KEEP_ALIVE || '30m',
  rateLimitPerMin: num(process.env.RATE_LIMIT_PER_MIN, 12),
  // which AI answers, in order (see above)
  providers,
  skippedProviders,
  aiTimeoutMs: num(process.env.AI_TIMEOUT_MS, 60000),
  // evaluations per account per day (0 = no limit). Handy on a public site with a free quota; off by default at home.
  maxEvalsPerDay: num(process.env.MAX_EVALS_PER_DAY, providers[0]?.kind === 'ollama' ? 0 : 10),
  // A ready-made account that is re-created on every start. Free hosts wipe their disk when they sleep or redeploy,
  // so this keeps one login working for a presentation. Leave DEMO_EMAIL empty to turn it off.
  demoName: process.env.DEMO_NAME || 'Demo User',
  demoEmail: String(process.env.DEMO_EMAIL || '').trim().toLowerCase(),
  demoPassword: process.env.DEMO_PASSWORD || '',
  // Postgres connection string (Supabase > Connect > Session pooler). When set, accounts and reports are stored there
  // instead of in a file. Set DATABASE_SSL=0 only for a Postgres on your own computer.
  databaseUrl: String(process.env.DATABASE_URL || '').trim(),
  databaseSsl: process.env.DATABASE_SSL !== '0',
  // accounts
  dataDir: process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url)),
  authSecret: process.env.AUTH_SECRET || '', // if empty, a random one is created once in data/.secret
  // Secure cookies only work over https. Set COOKIE_SECURE=0 when the site is opened over plain http on your Wi-Fi.
  cookieSecure: process.env.COOKIE_SECURE !== undefined && process.env.COOKIE_SECURE !== '' ? process.env.COOKIE_SECURE === '1' : process.env.NODE_ENV === 'production',
  authRateLimitPerMin: num(process.env.AUTH_RATE_LIMIT_PER_MIN, 30),
  // Hosts like Render put a proxy in front of the app. Trusting it lets us see each visitor's real IP address.
  trustProxy: num(process.env.TRUST_PROXY, process.env.RENDER ? 1 : 0),
  publicUrl: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  minIdeaChars: 15,
  maxIdeaChars: 4000,
  maxUploadBytes: 8 * 1024 * 1024
};