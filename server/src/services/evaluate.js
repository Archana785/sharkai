import { llmChat } from './llm.js';
import { EVALUATE_SYSTEM, evaluationSchema, buildEvaluateUser } from '../prompts/evaluate.js';
import { PITCH_SYSTEM, buildPitchUser } from '../prompts/pitch.js';
import { parseModelJson, normalizeEvaluation, cleanPitch, countWords } from '../lib/normalize.js';
import { AppError, BadModelOutput } from '../lib/errors.js';

const MIN_PITCH_WORDS = 120;

/** Write just the pitch (used for "Regenerate" and as a fallback when the evaluation's own pitch is too short). */
export async function generatePitch({ idea, strengths, improvements, variant = 0 }, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llmChat({
      system: PITCH_SYSTEM,
      user: buildPitchUser({ idea, strengths, improvements, variant }),
      temperature: 0.8,
      numPredict: 900,
      signal
    });
    const pitch = cleanPitch(raw);
    if (countWords(pitch) >= MIN_PITCH_WORDS) return pitch;
  }
  throw new AppError(502, 'BAD_MODEL_OUTPUT', 'The model could not write a full pitch this time. Please try again.');
}

/**
 * Idea in, structured evaluation out. One retry if the model's reply is unusable.
 * The pitch is NOT part of this call: it is written when the user opens the Pitch page, which saves about a third of the
 * tokens and seconds of every evaluation (and nothing is spent on pitches nobody reads).
 */
export async function evaluateIdea(idea, signal) {
  let reason;
  let result;
  let shorter; // a valid but shorter answer, kept in case the retry is not better
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    const raw = await llmChat({
      system: EVALUATE_SYSTEM,
      user: buildEvaluateUser(idea, reason),
      format: evaluationSchema,
      temperature: attempt === 0 ? 0.4 : 0.2,
      numPredict: 3400,
      signal
    });
    try {
      result = normalizeEvaluation(parseModelJson(raw));
    } catch (err) {
      if (!(err instanceof BadModelOutput)) throw err;
      reason = err.message;
      console.warn(`Evaluation attempt ${attempt + 1} unusable: ${reason}. The reply started with: ${String(raw).replace(/\s+/g, ' ').slice(0, 300)}`);
      if (err.tooShort) {
        try { shorter = normalizeEvaluation(parseModelJson(raw), { strict: false }); } catch { /* not usable at all */ }
      }
    }
  }
  if (!result && shorter) {
    console.warn('The AI kept its explanations short, so the shorter version is used.');
    result = shorter;
  }
  if (!result) {
    throw new AppError(502, 'BAD_MODEL_OUTPUT', 'The AI answered in an unexpected format. Please try again, or switch to a larger model (see the README).');
  }

  return result;
}