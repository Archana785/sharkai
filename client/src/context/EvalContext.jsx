import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateIdea } from '../lib/api.js';

// Each account keeps its own draft and last report on this device.
const keyFor = (userId) => `sharkai:v3:${userId || 'anon'}`;
// The stage animation needs a moment to be seen. Tests skip the wait.
const MIN_LOADING_MS = import.meta.env.MODE === 'test' ? 0 : 2000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || {};
  } catch {
    return {};
  }
}

const Ctx = createContext(null);
export const useEval = () => useContext(Ctx);

/**
 * Holds everything the four screens share:
 *   idea          what the user is typing (draft)
 *   analyzedIdea  the idea the current report was made from
 *   result        the AI's structured JSON (overallScore, verdict, strengths, improvements, evaluation, roadmap, pitch)
 *   phase         'idle' | 'loading' | 'error'   (drives the in-card loading state and inline error on the Home screen)
 * The last report is kept in localStorage so a refresh does not lose it.
 */
export function EvalProvider({ children, userId }) {
  const key = keyFor(userId);
  const saved = useMemo(() => load(key), [key]);
  const [idea, setIdea] = useState(saved.idea || '');
  const [analyzedIdea, setAnalyzedIdea] = useState(saved.analyzedIdea || '');
  const [result, setResult] = useState(saved.result || null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const controller = useRef(null);

  useEffect(() => {
    try {
      if (!idea && !result) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ idea, analyzedIdea, result }));
    } catch { /* storage full or blocked: not critical */ }
  }, [key, idea, analyzedIdea, result]);

  /** Runs the evaluation. Resolves true when a report is ready (the caller then opens the Report page), false otherwise. */
  const evaluate = useCallback(async () => {
    const text = idea.trim();
    if (phase === 'loading' || text.length < 15) return false;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setError(null);
    setPhase('loading');
    const started = Date.now();
    try {
      const data = await evaluateIdea(text, ctrl.signal);
      await wait(Math.max(0, MIN_LOADING_MS - (Date.now() - started)));
      if (ctrl.signal.aborted) return false;
      setResult(data);
      setAnalyzedIdea(text);
      setPhase('idle');
      return true;
    } catch (err) {
      if (ctrl.signal.aborted || err?.name === 'AbortError') return false;
      console.error('[SharkAI] evaluation failed:', err); // technical details stay in the console
      setError(err);
      setPhase('error');
      return false;
    }
  }, [idea, phase]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setPhase('idle');
  }, []);

  /** Forget everything about this account on this device (used when signing out). */
  const clearAll = useCallback(() => {
    controller.current?.abort();
    setIdea(''); setAnalyzedIdea(''); setResult(null); setError(null); setPhase('idle');
  }, []);

  /** Show a saved report on the Report page. */
  const openReport = useCallback(({ idea: text, result: saved }) => {
    setIdea(text); setAnalyzedIdea(text); setResult(saved);
  }, []);

  /** Replace the report's next steps with fuller ones (used to upgrade older reports). */
  const updateRoadmap = useCallback((roadmap) => setResult((r) => (r ? { ...r, roadmap, roadmapExpanded: true } : r)), []);

  const updatePitch = useCallback((pitch) => setResult((r) => (r ? { ...r, pitch } : r)), []);

  const value = { idea, setIdea, analyzedIdea, result, phase, error, evaluate, cancel, reset, updatePitch, updateRoadmap, clearAll, openReport };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}