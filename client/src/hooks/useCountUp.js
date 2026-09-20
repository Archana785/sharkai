import { useEffect, useState } from 'react';

const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 to `target` (ease-out) once `active` is true. */
export function useCountUp(target, { ms = 1500, active = true } = {}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (reduce()) { setValue(target); return undefined; }
    let raf;
    let t0;
    const step = (t) => {
      if (t0 === undefined) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, active]);
  return value;
}
