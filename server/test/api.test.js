import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

// --- a scriptable fake Ollama --------------------------------------------------------------------
let handler = (req, res) => res.end('{}');
let seen = [];
const fake = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const body = b ? JSON.parse(b) : null;
    seen.push({ url: req.url, body });
    handler(req, res, body);
  });
});
const listen = (srv, port = 0) => new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv.address().port)));
const reply = (res, content) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ message: { role: 'assistant', content } })); };

let base, app, appServer, fakePort;
before(async () => {
  fakePort = await listen(fake);
  process.env.OLLAMA_HOST = `http://127.0.0.1:${fakePort}`;
  process.env.OLLAMA_MODEL = 'llama3.1:8b';
  process.env.OLLAMA_TIMEOUT_MS = '600';
  process.env.RATE_LIMIT_PER_MIN = '1000';
  const { createApp } = await import('../src/app.js'); // imported after the env is set
  app = createApp({ clientDist: '/nonexistent' });
  appServer = http.createServer(app);
  base = `http://127.0.0.1:${await listen(appServer)}`;
});
after(() => { appServer.close(); fake.closeAllConnections?.(); fake.close(); });

const area = (score) => ({ score, title: 'x', description: 'A specific reason for this score.', insight: 'Do one thing.', businessTerm: 'x' });
const evalJson = (over = {}) => JSON.stringify({
  evaluation: { problem: area(80), market: area(70), competition: area(60), difference: area(72), growth: area(66), revenue: area(64) },
  verdict: 'Promising idea. Prove demand next.',
  strengths: ['s1', 's2', 's3'], improvements: ['i1', 'i2', 'i3'],
  roadmap: ['A: do a', 'B: do b', 'C: do c', 'D: do d'],
  pitch: 'We are building something people need. '.repeat(30),
  overallScore: 12,
  ...over
});
const IDEA = 'A quiet café for college students with study zones and hourly memberships.';
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const reset = (h) => { seen = []; handler = h; };

test('POST /api/evaluate: sends a schema and the idea to Ollama, returns the structured JSON', async () => {
  reset((req, res) => reply(res, evalJson()));
  const r = await post('/api/evaluate', { idea: IDEA });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(j.evaluation), ['problem', 'market', 'competition', 'difference', 'growth', 'revenue']);
  assert.equal(j.evaluation.difference.title, 'What makes it different?');
  assert.equal(j.evaluation.difference.businessTerm, 'USP (Unique Selling Proposition)');
  assert.equal(j.strengths.length, 3);
  assert.equal(j.improvements.length, 3);
  assert.equal(j.roadmap.length, 4);
  assert.ok(j.pitch.split(' ').length > 100);
  assert.equal(j.overallScore, 70, 'overall is recomputed from the six area scores, not trusted from the model (it said 12)');
  const sent = seen[0];
  assert.equal(sent.url, '/api/chat');
  assert.equal(sent.body.model, 'llama3.1:8b');
  assert.equal(sent.body.stream, false);
  assert.equal(typeof sent.body.format, 'object');
  assert.ok(sent.body.format.properties.evaluation);
  assert.ok(sent.body.messages[1].content.includes('<idea>') && sent.body.messages[1].content.includes(IDEA));
});

test('unusable output is retried once with the reason; two failures become BAD_MODEL_OUTPUT', async () => {
  let n = 0;
  reset((req, res) => reply(res, ++n === 1 ? 'Sorry, I cannot do that.' : evalJson()));
  let r = await post('/api/evaluate', { idea: IDEA });
  assert.equal(r.status, 200);
  assert.equal(n, 2);
  assert.match(seen[1].body.messages[1].content, /previous reply could not be used/);

  reset((req, res) => reply(res, 'still not json'));
  r = await post('/api/evaluate', { idea: IDEA });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error.code, 'BAD_MODEL_OUTPUT');
});

test('a too-short pitch inside the JSON triggers a separate pitch call', async () => {
  reset((req, res, body) => {
    if (body.messages[0].content.includes('pitch coach')) return reply(res, '**Here is your pitch:**\n\n' + 'A full spoken pitch for the judges. '.repeat(40));
    reply(res, evalJson({ pitch: 'too short' }));
  });
  const j = await (await post('/api/evaluate', { idea: IDEA })).json();
  assert.equal(seen.length, 2);
  assert.ok(j.pitch.split(' ').length >= 120);
  assert.ok(!/[*#]/.test(j.pitch));
});

test('errors: Ollama down, model missing, timeout', async () => {
  // model missing
  reset((req, res) => { res.statusCode = 404; res.end(JSON.stringify({ error: "model 'llama3.1:8b' not found" })); });
  let r = await post('/api/evaluate', { idea: IDEA });
  let j = await r.json();
  assert.equal(r.status, 503);
  assert.equal(j.error.code, 'MODEL_MISSING');
  assert.match(j.error.message, /ollama pull llama3\.1:8b/);

  // timeout (the fake never answers; the limit is 600 ms in this test run)
  reset(() => { /* silence */ });
  r = await post('/api/evaluate', { idea: IDEA });
  assert.equal(r.status, 504);
  assert.equal((await r.json()).error.code, 'TIMEOUT');

  // Ollama down: nothing is listening any more
  fake.closeAllConnections?.();
  await new Promise((res) => fake.close(res));
  r = await post('/api/evaluate', { idea: IDEA });
  j = await r.json();
  assert.equal(r.status, 503);
  assert.equal(j.error.code, 'OLLAMA_DOWN');
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.ollama, 'down');
  await listen(fake, fakePort); // bring it back for the remaining tests
});

test('a JSON-schema format that this Ollama version rejects falls back to plain JSON mode', async () => {
  reset((req, res, body) => {
    if (typeof body.format === 'object') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid format: expected "json"' })); }
    reply(res, evalJson());
  });
  const r = await post('/api/evaluate', { idea: IDEA });
  assert.equal(r.status, 200);
  assert.equal(seen.at(-1).body.format, 'json');
});

test('input validation, unknown routes and error shape', async () => {
  let r = await post('/api/evaluate', { idea: 'hi' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'IDEA_TOO_SHORT');
  r = await post('/api/evaluate', { idea: 'x'.repeat(4001) });
  assert.equal((await r.json()).error.code, 'IDEA_TOO_LONG');
  r = await fetch(base + '/api/nope');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error.code, 'NOT_FOUND');
  r = await fetch(base + '/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'BAD_REQUEST');
});

test('POST /api/pitch returns one clean paragraph and uses a different style per variant', async () => {
  reset((req, res) => reply(res, '## Problem\n\n"Hello judges. ' + 'We build things people need. '.repeat(45) + '"'));
  const j = await (await post('/api/pitch', { idea: IDEA, strengths: ['s1'], improvements: ['i1'], variant: 1 })).json();
  assert.equal(j.pitch.includes('\n'), false);
  assert.ok(!/[#*"]/.test(j.pitch.slice(0, 3)));
  const first = seen[0].body.messages[1].content;
  assert.match(first, /Style for this version/);
  await post('/api/pitch', { idea: IDEA, variant: 2 });
  assert.notEqual(seen[1].body.messages[1].content.split('Style for this version:')[1], first.split('Style for this version:')[1]);
});

test('GET /api/health reports Ollama and the model', async () => {
  reset((req, res) => res.end(JSON.stringify({ models: [{ name: 'llama3.1:8b' }] })));
  let h = await (await fetch(base + '/api/health')).json();
  assert.deepEqual([h.ollama, h.modelInstalled], ['up', true]);
  reset((req, res) => res.end(JSON.stringify({ models: [{ name: 'other:1b' }] })));
  h = await (await fetch(base + '/api/health')).json();
  assert.deepEqual([h.ollama, h.modelInstalled], ['up', false]);
});

test('closing the browser request aborts the call to Ollama', async () => {
  let ollamaSawClose = false;
  reset((req, res) => { res.on('close', () => { ollamaSawClose = true; }); req.socket.on('close', () => { ollamaSawClose = true; }); });
  const ctrl = new AbortController();
  const p = fetch(base + '/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: IDEA }), signal: ctrl.signal }).catch(() => 'aborted');
  await new Promise((r) => setTimeout(r, 200));
  ctrl.abort();
  assert.equal(await p, 'aborted');
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(ollamaSawClose, true);
});

test('POST /api/extract reads .txt, .pptx, .pdf and rejects other types and broken files', async () => {
  const up = (name, data) => { const f = new FormData(); f.append('file', new Blob([data]), name); return fetch(base + '/api/extract', { method: 'POST', body: f }); };
  let j = await (await up('idea.txt', 'My idea is a study café.')).json();
  assert.equal(j.text, 'My idea is a study café.');
  assert.equal(j.truncated, false);
  j = await (await up('deck.pptx', fs.readFileSync(new URL('./fixtures/deck.pptx', import.meta.url)))).json();
  assert.match(j.text, /Study Cafe/);
  assert.match(j.text, /hourly/i);
  j = await (await up('deck.pdf', fs.readFileSync(new URL('./fixtures/deck.pdf', import.meta.url)))).json();
  assert.match(j.text, /quiet place for students/);
  let r = await up('virus.exe', 'x');
  assert.equal(r.status, 415);
  assert.equal((await r.json()).error.code, 'UNSUPPORTED_FILE');
  r = await up('broken.pptx', 'not a zip');
  assert.equal(r.status, 422);
  assert.equal((await r.json()).error.code, 'UNREADABLE_FILE');
  r = await up('long.txt', 'word '.repeat(2000));
  j = await r.json();
  assert.equal(j.text.length, 4000);
  assert.equal(j.truncated, true);
  r = await up('empty.txt', '   ');
  assert.equal((await r.json()).error.code, 'EMPTY_FILE');
});

test('rate limiter blocks after the limit', async () => {
  const { rateLimit } = await import('../src/middleware/rateLimit.js');
  const mw = rateLimit({ max: 2 });
  const results = [];
  for (let i = 0; i < 3; i++) mw({ ip: '1.2.3.4' }, {}, (e) => results.push(e?.code || 'ok'));
  assert.deepEqual(results, ['ok', 'ok', 'RATE_LIMITED']);
});
