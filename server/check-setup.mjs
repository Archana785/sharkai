// Checks that SharkAI is set up correctly and that Groq answers.  Run it from the server folder:
//     node check-setup.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
let problems = 0;
const check = (ok, text) => { console.log(`  ${ok ? 'OK  ' : 'FIX '} ${text}`); if (!ok) problems++; };
const finish = () => {
  console.log(problems ? `\n${problems} thing(s) to fix. Fix them, save, and run this check again.\n` : '\nEverything is ready. Start the site with:  npm run dev   (from the project folder)\n');
  process.exit(problems ? 1 : 0);
};

console.log('\nSharkAI setup check\n');

// 1. Are all the files there, and are they the newest versions?
const server = [
  ['src/index.js', 'llmHealth'], ['src/app.js', 'trust proxy'], ['src/config.js', 'trustProxy'],
  ['src/lib/auth.js', 'hashPassword'], ['src/lib/store.js', 'getCached'], ['src/lib/errors.js', 'fields'],
  ['src/lib/normalize.js', 'sentence'], ['src/lib/extract.js'],
  ['src/middleware/auth.js', 'requireAuth'], ['src/middleware/rateLimit.js', 'req.user'],
  ['src/routes/api.js', 'llmCheck'], ['src/routes/auth.js', 'startSession'], ['src/routes/reports.js', 'reportsRouter'],
  ['src/services/llm.js', 'llmCheck'], ['src/services/evaluate.js', "from './llm.js'"], ['src/services/ollama.js'],
  ['src/prompts/evaluate.js', 'headline'], ['src/prompts/pitch.js']
].map(([f, marker]) => ({ file: `server/${f}`, abs: path.join(root, f), marker }));
const client = [
  ['main.jsx', 'AuthProvider'], ['App.jsx', 'RequireAuth'], ['lib/api.js', 'authApi'], ['lib/format.js', 'conciseSentence'],
  ['context/AuthContext.jsx', 'AuthProvider'], ['context/EvalContext.jsx', 'clearAll'],
  ['components/Nav.jsx', 'AccountMenu'], ['components/AccountMenu.jsx'], ['components/Footer.jsx'], ['components/AuthUI.jsx'],
  ['components/ReportRow.jsx'], ['components/QuestionCard.jsx', 'conciseSentence'], ['components/Workspace.jsx', 'AI_BUSY'],
  ['pages/Login.jsx'], ['pages/Signup.jsx'], ['pages/ForgotPassword.jsx'], ['pages/ResetPassword.jsx'],
  ['pages/Dashboard.jsx'], ['pages/SavedReports.jsx'], ['pages/Settings.jsx'], ['pages/Home.jsx'], ['pages/Report.jsx', 'report-top'],
  ['styles/global.css'], ['styles/refine.css', 'report-top'], ['styles/shell.css']
].map(([f, marker]) => ({ file: `client/src/${f}`, abs: path.join(root, '..', 'client', 'src', f), marker }));

const missing = []; const outdated = [];
for (const f of [...server, ...client]) {
  if (!fs.existsSync(f.abs)) { missing.push(f.file); continue; }
  if (f.marker && !fs.readFileSync(f.abs, 'utf8').includes(f.marker)) outdated.push(f.file);
}
check(!missing.length, missing.length ? `Missing files (create them, and check the folder): ${missing.join(', ')}` : 'All the files are there');
check(!outdated.length, outdated.length ? `Old versions (open each one, select all with Ctrl+A, and paste the newest code from the chat): ${outdated.join(', ')}` : 'All the files are the newest versions');
if (missing.length || outdated.length) finish();

// 2. Is there a .env file with a key?
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) check(true, 'The .env file is in the server folder');
else if (process.env.GROQ_API_KEY) console.log('  NOTE There is no .env file, but the key was set another way (that works too)');
else check(false, 'There is no .env file. Create it inside the server folder (the name is exactly .env, not .env.txt)');

// 3. Do all the code files load?
let config; let llmCheck;
try {
  ({ config } = await import('./src/config.js'));
  await import('./src/app.js');
  ({ llmCheck } = await import('./src/services/llm.js'));
  check(true, 'All code files load without errors');
} catch (err) {
  check(false, `A code file has a problem: ${String(err.message).split('\n')[0]}`);
  console.log('     (the message above names the file; open it and paste the whole file again from the chat)');
  finish();
}

// 4. Is Groq set up?
const wantsGroq = String(process.env.AI_PROVIDER || '').toLowerCase().split(',').map((s) => s.trim()).includes('groq');
check(wantsGroq, wantsGroq ? `AI_PROVIDER includes groq (AI order: ${config.providers.map((p) => p.name).join(' -> ')})` : 'AI_PROVIDER is not set in .env. Add the line:  AI_PROVIDER=groq,gemini');
const groq = config.providers.find((p) => p.name === 'groq');
if (wantsGroq) {
  check(!!groq, groq ? 'A Groq key was found' : 'GROQ_API_KEY is empty in .env. Paste your key after the = sign');
  if (groq) {
    const key = groq.apiKey;
    console.log(`       key: ${key.slice(0, 4)}... (${key.length} characters, never shown in full)`);
    check(!/[\s"']/.test(key), 'The key has no spaces or quotation marks');
    check(key.startsWith('gsk_'), 'The key starts with gsk_ like Groq keys do');
  }
}
const backups = config.skippedProviders.filter((n) => n !== 'groq');
if (backups.length) console.log(`  NOTE ${backups.join(', ')} has no key, so it is skipped (that is fine, it is only a backup)`);

// 5. Does Groq really answer? (a tiny test, about 20 tokens)
if (groq) {
  console.log('\n  Asking each AI a tiny question...');
  const r = await llmCheck();
  for (const x of r.results) {
    check(x.ok, x.ok ? `${x.provider} answered (${x.model}, ${x.ms ? `${x.ms} ms` : 'ok'})` : `${x.provider} did not answer: ${x.problem}`);
    if (x.note) console.log(`       note: ${x.note}`);
  }
}
finish();
