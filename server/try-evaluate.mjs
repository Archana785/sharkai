// Runs one REAL evaluation through the same code the website uses, and shows the result or the exact reason it failed.
// Run it from the server folder:   node try-evaluate.mjs
import { config } from './src/config.js';
import { evaluateIdea } from './src/services/evaluate.js';
import { generatePitch } from './src/services/evaluate.js';

console.log(`\nAI order: ${config.providers.map((p) => `${p.name} (${p.models.join(' > ')})`).join('  ->  ')}`);
const idea = 'I want to build a cafe where college students can study comfortably while ordering affordable food and drinks. It is mainly for students who need a quiet place to study. Unlike regular cafes, it offers study zones and hourly memberships.';
console.log('\nEvaluating a sample idea (this is what the Evaluate button does)...\n');
const t0 = Date.now();
try {
  const r = await evaluateIdea(idea);
  console.log(`SUCCESS in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`  overall score: ${r.overallScore}`);
  console.log(`  verdict: ${r.verdict}`);
  for (const [k, v] of Object.entries(r.evaluation)) console.log(`  ${k.padEnd(11)} ${String(v.score).padStart(3)}  ${v.headline}`);
  console.log('\nNow writing the pitch (this is what the Pitch page does)...');
  const t1 = Date.now();
  const pitch = await generatePitch({ idea, strengths: r.strengths, improvements: r.improvements });
  console.log(`SUCCESS in ${((Date.now() - t1) / 1000).toFixed(1)} s, ${pitch.split(/\s+/).length} words`);
  console.log(`  starts: ${pitch.slice(0, 160)}...\n`);
} catch (err) {
  console.log(`FAILED after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`  code:    ${err.code || err.name}`);
  console.log(`  reason:  ${err.message}`);
  console.log('\nCopy everything above (the AI order line and the lines starting with [SharkAI] or "Evaluation attempt") and send it.\n');
  process.exit(1);
}
