import { useEffect, useState } from 'react';
import { useCountUp } from '../hooks/useCountUp.js';

const CIRC = 2 * Math.PI * 52;

/** Gold circular score that fills and counts up when it appears. */
export default function ScoreRing({ score }) {
  const [filled, setFilled] = useState(false);
  const shown = useCountUp(score, { ms: 1600 });
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="ring" role="img" aria-label={`Overall score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r="52" />
        <circle className="prog" cx="60" cy="60" r="52" style={{ strokeDashoffset: filled ? CIRC * (1 - score / 100) : CIRC }} />
      </svg>
      <div className="center" aria-hidden="true">
        <span className="num">{shown}</span>
        <span className="of">out of 100</span>
      </div>
    </div>
  );
}
