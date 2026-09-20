export const labelFor = (s) => (s >= 80 ? 'Strong idea' : s >= 68 ? 'Promising' : s >= 55 ? 'Early stage' : 'Needs work');
export const chipFor = (s) => (s >= 78 ? 'Strong' : s >= 66 ? 'Solid' : s >= 55 ? 'Developing' : 'Needs work');

/** Colours for a score: green / teal / amber / red. */
export function tone(score) {
  if (score >= 78) return { color: 'var(--green)', bg: 'rgba(123,211,160,0.14)' };
  if (score >= 66) return { color: 'var(--teal)', bg: 'rgba(43,181,166,0.14)' };
  if (score >= 55) return { color: 'var(--amber)', bg: 'rgba(232,163,79,0.14)' };
  return { color: 'var(--red)', bg: 'rgba(217,130,130,0.14)' };
}

export const countWords = (text) => (String(text).trim().match(/\S+/g) || []).length;

/** Calm speaking pace: about 130 words per minute. */
export const speakingSeconds = (words) => Math.round((words / 130) * 60);
export const formatTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/** Roadmap items arrive as "Short title: one sentence". Split them for display. */
export function splitStep(text) {
  const t = String(text || '').trim();
  const i = t.indexOf(':');
  if (i > 0 && i <= 60) return { title: t.slice(0, i).trim(), body: t.slice(i + 1).trim() || t };
  const words = t.split(/\s+/);
  return { title: words.slice(0, 4).join(' '), body: t };
}

/** First sentence of a text, trimmed to `max` characters. */
export function firstSentence(text, max = 140) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  const m = flat.match(/^.+?[.!?](?=\s|$)/);
  const s = m ? m[0] : flat;
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

/** A realistic goal for one area after the suggested improvement: closes roughly a third of the gap, at least 5 points, capped at 95. */
export const targetScore = (score) => Math.min(95, score + Math.max(5, Math.round((100 - score) * 0.35)));

const ensureEnd = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);

/**
 * One naturally short sentence for a card (about 10-15 words).
 * Uses the AI's own `headline`; if it is missing, picks the first clause of the explanation. It never adds "...".
 */
export function conciseSentence(area) {
  const own = firstSentence(area?.headline, 220);
  const n = countWords(own);
  if (own && n >= 4 && n <= 22) return ensureEnd(own);
  const s = firstSentence(area?.description, 400);
  if (countWords(s) <= 15) return ensureEnd(s);
  const clause = s.split(/,\s+(?:and|but|so|while|because|which|though|yet)\s+|;\s+/i)[0];
  const cw = countWords(clause);
  return cw >= 6 && cw <= 18 ? ensureEnd(clause) : s; // keep the whole sentence rather than cutting it
}
