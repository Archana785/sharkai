import { useRef } from 'react';
import { useCountUp } from '../hooks/useCountUp.js';
import { useInView } from '../hooks/useInView.js';
import { chipFor, conciseSentence, targetScore, tone } from '../lib/format.js';

/**
 * One report card, filled from one entry of the AI's `evaluation` object.
 * On the card: question, score, progress bar, one short sentence, status badge and category label.
 * The full advice (why, how to improve, expected score) opens ABOVE the card, in front of everything, on hover or keyboard focus.
 */
export default function QuestionCard({ data }) {
  const [ref, seen] = useInView();
  const shown = useCountUp(data.score, { ms: 1500, active: seen });
  const tipRef = useRef(null);
  const t = tone(data.score);

  // The popup opens above the card. If the card is so high on the screen that the popup would be cut off,
  // slide it down just enough to stay fully visible (it then covers the top of its own card, still in front of the others).
  const keepOnScreen = () => {
    const card = ref.current; const tip = tipRef.current;
    if (!card || !tip) return;
    const r = card.getBoundingClientRect();
    const wouldStartAt = r.top - (tip.offsetHeight + 14);
    const clearOfNavbar = 84;
    tip.style.setProperty('--shift', wouldStartAt < clearOfNavbar ? `${Math.min(clearOfNavbar - wouldStartAt, r.height + 24)}px` : '0px');
  };

  return (
    <article ref={ref} className={`qcard tw reveal${seen ? ' in' : ''}`} tabIndex={0} onMouseEnter={keepOnScreen} onFocus={keepOnScreen}>
      <div className="qhead">
        <h3 className="qtitle">{data.title}</h3>
        <div className="qscore"><b>{seen ? shown : 0}</b><span>/100</span></div>
      </div>
      <div className="bar"><i style={{ width: seen ? `${data.score}%` : 0, background: t.color }} /></div>
      <p className="qsent">{conciseSentence(data)}</p>
      <div className="qfoot">
        <span className="pill" style={{ background: t.bg, color: t.color }}>{chipFor(data.score)}</span>
        <span className="qcat">{data.businessTerm}</span>
      </div>
      <div ref={tipRef} className="tip solid" role="tooltip">
        <div className="tip-row"><strong>Why this score was given</strong><span>{data.description}</span></div>
        <div className="tip-row"><strong>How to improve</strong><span>{data.insight || 'Talk to at least 20 to 30 people who match your target customer before you spend money. Ask what they do today, what frustrates them, and what would make them switch. Use their answers to sharpen this part of your idea.'}</span></div>
        <div className="tip-row target"><strong>Expected score after improvement</strong><span>{data.score} → {targetScore(data.score)}</span></div>
      </div>
    </article>
  );
}