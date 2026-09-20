import { llmChat } from './llm.js';
import { ROADMAP_SYSTEM, roadmapSchema, buildRoadmapUser } from '../prompts/roadmap.js';
import { parseModelJson, countWords } from '../lib/normalize.js';
import { AppError, BadModelOutput } from '../lib/errors.js';

const MIN_STEP_WORDS = 55; // a step with fewer words than this is asked for again

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const sentence = (v, max) => {
  const t = clean(v, max);
  if (!t) return t;
  const up = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(up) ? up : `${up}.`;
};
const bodyOf = (step) => { const i = step.indexOf(':'); return i > 0 && i <= 60 ? step.slice(i + 1) : step; };

/** Four steps arrive as { title, what, why, actions, success }. Each becomes "Title: one paragraph". */
function toSteps(value) {
  const list = (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') return sentence(item, 1000);
    if (!item || typeof item !== 'object') return '';
    const title = clean(item.title, 60).replace(/[:.\s]+$/, '');
    const parts = ['what', 'why', 'actions', 'success'].map((k) => sentence(item[k], 400)).filter(Boolean);
    return title && parts.length ? `${title}: ${parts.join(' ')}` : '';
  }).filter(Boolean);
  if (list.length < 4) throw new BadModelOutput(`the roadmap needs 4 steps, got ${list.length}`);
  return list.slice(0, 4);
}

/**
 * Rewrites four short next steps as full paragraphs (about 75 to 95 words each). Used to upgrade older reports.
 * One retry if a step comes back too short; if the retry is short too, the best answer so far is used.
 */
export async function expandRoadmap({ idea, steps }, signal) {
  let reason;
  let best;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llmChat({
      system: ROADMAP_SYSTEM,
      user: buildRoadmapUser(idea, steps, reason),
      format: roadmapSchema,
      temperature: attempt === 0 ? 0.4 : 0.2,
      numPredict: 1800,
      signal
    });
    try {
      const list = toSteps(parseModelJson(raw)?.roadmap);
      best = list;
      const short = list.map((step, i) => (countWords(bodyOf(step)) < MIN_STEP_WORDS ? i + 1 : 0)).filter(Boolean);
      if (!short.length) return list;
      reason = `step ${short.join(', ')} is too short: each needs about 75 to 95 words with what, why, actions and success filled in properly`;
    } catch (err) {
      if (!(err instanceof BadModelOutput)) throw err;
      reason = err.message;
    }
  }
  if (best) return best;
  throw new AppError(502, 'BAD_MODEL_OUTPUT', 'The AI could not write the steps in full this time. Please try again.');
}