import { useInView } from '../hooks/useInView.js';

const STEPS = ['Share your idea', 'AI evaluates', 'Get report & pitch'];

/** Three numbered steps in one line, joined by thin arrows. Typography only: no icons, no boxes. */
export default function HowItWorks() {
  const [ref, seen] = useInView();
  return (
    <section ref={ref} className={`how reveal${seen ? ' in' : ''}`} aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <ol className="how-line">
        {STEPS.flatMap((label, i) => {
          const step = (
            <li key={label} className="how-step">
              <span className="how-num">{i + 1}</span>
              <span className="how-name">{label}</span>
            </li>
          );
          return i < STEPS.length - 1 ? [step, <li key={`s${i}`} className="how-sep" aria-hidden="true" />] : [step];
        })}
      </ol>
    </section>
  );
}