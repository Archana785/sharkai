import { BadModelOutput } from './errors.js';

/** The six report cards, in display order. Titles and terms are enforced here so the UI is always consistent. */
export const AREAS = [
  { key: 'problem', title: 'Does this solve a real problem?', businessTerm: 'Problem Validation', weight: 0.22 },
  { key: 'market', title: 'Will people actually use it?', businessTerm: 'Market Potential', weight: 0.2 },
  { key: 'competition', title: 'How crowded is the market?', businessTerm: 'Competition Analysis', weight: 0.12 },
  { key: 'difference', title: 'What makes it different?', businessTerm: 'USP (Unique Selling Proposition)', weight: 0.16 },
  { key: 'growth', title: 'Can this grow?', businessTerm: 'Scalability', weight: 0.14 },
  { key: 'revenue', title: 'Can it make money?', businessTerm: 'Revenue Model', weight: 0.16 }
];

// Explanations must be written out in full. Below these many words the AI is asked to try again (see evaluateIdea).
// Set STRICT_TEXT=0 to switch this check off.
const STRICT_DEFAULT = process.env.STRICT_TEXT !== '0';
const MIN_WORDS = { description: 30, insight: 25, roadmap: 55 };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/** "fifty", "sixty-five", "seventy five out of one hundred", "one hundred" -> a number, or NaN when there is no number word. */
function wordsToNumber(text) {
  let total = 0;
  let found = false;
  for (const w of String(text).toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')) {
    if (w === 'out' || w === 'of' || w === 'percent' || w === 'over') break;
    if (Object.hasOwn(ONES, w)) { total += ONES[w]; found = true; }
    else if (Object.hasOwn(TENS, w)) { total += TENS[w]; found = true; }
    else if (w === 'hundred') { total = (total || 1) * 100; found = true; }
  }
  return found ? total : NaN;
}
/** A score can arrive as 45, "45", "45/100", "45%", "45 out of 100" or in words ("fifty", "sixty-five"). Anything else is not a score. */
const toScore = (v) => {
  if (typeof v === 'number') return Math.round(v);
  const s = String(v ?? '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Math.round(Number(m[0])) : wordsToNumber(s);
};
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** A tidy sentence: starts with a capital letter and ends with a full stop (models sometimes forget both). */
const sentence = (v, max) => {
  let t = text(v, max).replace(/\.{3}$|…$/, '').trim();
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/** Pull a JSON object out of the model's reply, even if it wrapped it in ```json fences or added chatter. */
export function parseModelJson(raw) {
  let t = String(raw ?? '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new BadModelOutput('no JSON object found');
  t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); // trailing commas
    } catch {
      throw new BadModelOutput('invalid JSON');
    }
  }
}

function toStrings(value, count, label, max = 240) {
  const list = (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? item : item?.text))
    .map((s) => sentence(s, max))
    .filter(Boolean);
  if (list.length < count) throw new BadModelOutput(`${label} needs ${count} items, got ${list.length}`);
  return list.slice(0, count);
}

/** Each roadmap step arrives as { title, what, why, actions, success } (or, from older answers, one string). It becomes "Title: one paragraph". */
function roadmapStrings(value) {
  const list = (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') return sentence(item, 1000);
    if (item && typeof item === 'object') {
      const title = text(item.title, 60).replace(/[:.\s]+$/, '');
      const parts = ['what', 'why', 'actions', 'success'].map((k) => sentence(item[k], 400)).filter(Boolean);
      return title && parts.length ? `${title}: ${parts.join(' ')}` : '';
    }
    return '';
  }).filter(Boolean);
  if (list.length < 4) throw new BadModelOutput(`roadmap needs 4 items, got ${list.length}`);
  return list.slice(0, 4);
}

/** Make a pitch safe to display: one plain paragraph, no markdown, no "Here is your pitch:" preamble. */
export function cleanPitch(raw) {
  let t = String(raw ?? '').replace(/\r/g, '');
  t = t.replace(/^```[a-z]*\s*|```\s*$/gi, '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && /:\s*$/.test(lines[0]) && lines[0].length < 80) lines.shift(); // "Here is your pitch:"
  t = lines.join(' ');
  t = t.replace(/[*_#>`]+/g, '').replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
  return t;
}

export const countWords = (s) => (String(s).trim().match(/\S+/g) || []).length;

const bodyOf = (step) => { const i = step.indexOf(':'); return i > 0 && i <= 60 ? step.slice(i + 1) : step; };

/** Lists every explanation that is too short, grouped, in plain words the AI can act on. */
function shortParts(result) {
  const d = []; const n = []; const r = [];
  for (const a of AREAS) {
    const e = result.evaluation[a.key];
    if (countWords(e.description) < MIN_WORDS.description) d.push(a.key);
    if (countWords(e.insight) < MIN_WORDS.insight) n.push(a.key);
  }
  result.roadmap.forEach((step, i) => { if (countWords(bodyOf(step)) < MIN_WORDS.roadmap) r.push(i + 1); });
  const out = [];
  if (d.length) out.push(`the descriptions for ${d.join(', ')} are too short (each needs 50 to 90 words)`);
  if (n.length) out.push(`the insights for ${n.join(', ')} are too short (each needs 45 to 80 words)`);
  if (r.length) out.push(`roadmap step ${r.join(', ')} needs 75 to 95 words in total: fill in what, why, actions and success properly`);
  return out;
}

/**
 * Validate and clean the model's evaluation. Throws BadModelOutput when it is unusable.
 * The overall score is recomputed from the six area scores (weighted), so it always matches the cards.
 */
export function normalizeEvaluation(raw, { strict = STRICT_DEFAULT } = {}) {
  if (!raw || typeof raw !== 'object') throw new BadModelOutput('not an object');
  const src = raw.evaluation;
  if (!src || typeof src !== 'object') throw new BadModelOutput('missing evaluation');

  const evaluation = {};
  let total = 0;
  for (const a of AREAS) {
    const r = src[a.key];
    if (!r || typeof r !== 'object') throw new BadModelOutput(`missing area "${a.key}"`);
    const score = toScore(r.score);
    const description = sentence(r.description, 1100);
    if (!Number.isFinite(score)) throw new BadModelOutput(`bad score for "${a.key}" (got ${JSON.stringify(r.score)})`);
    if (!description) throw new BadModelOutput(`missing description for "${a.key}"`);
    const s = clamp(score, 0, 100);
    evaluation[a.key] = {
      score: s,
      title: a.title,
      description,
      headline: sentence(r.headline, 200),
      insight: sentence(r.insight, 800),
      businessTerm: a.businessTerm
    };
    total += s * a.weight;
  }

  const verdict = sentence(raw.verdict, 400);
  if (!verdict) throw new BadModelOutput('missing verdict');

  const result = {
    overallScore: Math.round(total),
    verdict,
    strengths: toStrings(raw.strengths, 3, 'strengths'),
    improvements: toStrings(raw.improvements, 3, 'improvements'),
    evaluation,
    roadmap: roadmapStrings(raw.roadmap),
    pitch: cleanPitch(raw.pitch)
  };
  if (strict) {
    const short = shortParts(result);
    if (short.length) {
      throw Object.assign(new BadModelOutput(`some explanations are too short: ${short.join('; ')}. Write every explanation in full, at the length asked in the instructions`), { tooShort: true });
    }
  }
  return result;
}