// Shows which Groq models your key can really use, and what to put in .env.
// Run it from the server folder:   node list-groq-models.mjs
import { config } from './src/config.js';

const p = config.providers.find((x) => x.name === 'groq');
if (!p) { console.log('\nNo Groq key was found. Check server/.env (AI_PROVIDER and GROQ_API_KEY).\n'); process.exit(1); }

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` };
let res;
try { res = await fetch(`${p.baseUrl}/models`, { headers }); } catch (err) { console.log(`\nCould not reach Groq: ${err.message}\nCheck your internet connection (try your phone hotspot).\n`); process.exit(1); }
const json = await res.json().catch(() => null);
console.log(`\nGroq answered with status ${res.status}`);
if (!res.ok) { console.log(json?.error?.message || 'It could not list the models.'); console.log('If this says the key is invalid, create a new key at console.groq.com.\n'); process.exit(1); }

const ids = (json.data || []).map((m) => m.id).sort();
console.log(`\nYour key can see ${ids.length} models:\n`);
ids.forEach((id) => console.log(`  ${id}`));

const skip = /whisper|tts|guard|embed|orpheus|safeguard|compound|moderation|transcri|speech|image/i;
console.log('\nTesting the chat models with a tiny request (about 10 tokens each)...\n');
const works = [];
for (const id of ids.filter((m) => !skip.test(m))) {
  const r = await fetch(`${p.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model: id, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 5, temperature: 0 }) });
  const j = await r.json().catch(() => null);
  console.log(`  ${r.ok ? 'WORKS' : 'no   '}  ${id}${r.ok ? '' : `   (${r.status}: ${String(j?.error?.message || '').slice(0, 90)})`}`);
  if (r.ok) works.push(id);
}

const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'openai/gpt-oss-120b', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const rank = (id) => { const i = preferred.indexOf(id); return i >= 0 ? i : /allam/i.test(id) ? 500 : 100; }; // allam is Arabic-focused: last
const best = [...works].sort((a, b) => rank(a) - rank(b));
if (!best.length) {
  console.log('\nNo chat model worked with this key. Open console.groq.com, check Settings / Limits for model permissions, or create a new key.');
  console.log('Add a Gemini key as a backup:  GEMINI_API_KEY=...  (free at aistudio.google.com/apikey)\n');
} else {
  console.log('\nPut these lines in server/.env (replace any GROQ_MODEL lines), save, and restart the site:\n');
  console.log(`GROQ_MODEL=${best[0]}`);
  if (best[1]) console.log(`GROQ_FALLBACK_MODEL=${best[1]}`);
  console.log('');
}
