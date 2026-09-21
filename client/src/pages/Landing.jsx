import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useInView } from '../hooks/useInView.js';

const STEPS = [
  { title: 'Share your idea', text: 'Tell SharkAI about your startup idea.' },
  { title: 'Get your evaluation', text: 'SharkAI analyzes your idea and gives you useful feedback.' },
  { title: 'Know what to do next', text: 'Get clear direction on what to improve or explore next.' }
];

const BENEFITS = [
  { title: 'Idea Evaluation', text: 'Understand the strengths and gaps in your startup idea.' },
  { title: 'Actionable Insights', text: 'See the key areas that need attention.' },
  { title: 'Next Steps', text: 'Get practical direction for moving your idea forward.' }
];

/** A page section with a centred heading that fades in the first time it scrolls into view. */
function Section({ id, titleId, title, children }) {
  const [ref, seen] = useInView();
  return (
    <section id={id} ref={ref} className={`lp-section reveal${seen ? ' in' : ''}`} aria-labelledby={titleId}>
      <div className="lp-head">
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * The public front page: a short hero, three steps, three benefits and a closing call to action. It says what SharkAI is
 * and why to try it; the detailed experience is found after signing in. Both "Evaluate My Idea" buttons lead to /evaluate,
 * which asks visitors to sign in first and, once they have, opens the Evaluate page directly.
 */
export default function Landing() {
  const [ctaRef, ctaSeen] = useInView();

  // Scroll to the steps and move keyboard focus with the view. The page's CSS handles smooth scrolling and "reduce motion".
  const showHow = (e) => {
    e.preventDefault();
    const heading = document.getElementById('how-title');
    heading?.scrollIntoView();
    heading?.focus({ preventScroll: true });
  };

  return (
    <div className="wrap lp">
      <header className="lp-hero">
        <h1 className="rise d1">See how strong your startup idea really is.</h1>
        <p className="lp-lede rise d2">SharkAI helps you evaluate your startup idea, understand where it stands, and get clear next steps to move forward.</p>
        <div className="lp-actions rise d3">
          <Link className="btn btn-primary" to="/evaluate"><span>Evaluate My Idea</span><Icon name="arrow" size={18} sw={2} /></Link>
          <a className="btn btn-ghost" href="#how-it-works" onClick={showHow}>See How It Works</a>
        </div>
      </header>

      <Section id="how-it-works" titleId="how-title" title="How It Works">
        <ol className="lp-grid lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="lp-card">
              <span className="lp-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="get" titleId="get-title" title="What You Get">
        <div className="lp-grid lp-get">
          {BENEFITS.map((b) => (
            <article key={b.title} className="lp-card">
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <section ref={ctaRef} className={`lp-final reveal${ctaSeen ? ' in' : ''}`} aria-labelledby="final-title">
        <div className="cta">
          <h2 id="final-title">Ready to test your idea?</h2>
          <Link className="btn btn-primary" to="/evaluate"><span>Evaluate My Idea</span><Icon name="arrow" size={18} sw={2} /></Link>
        </div>
      </section>
    </div>
  );
}
