import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useInView } from '../hooks/useInView.js';

const STEPS = [
  { title: 'Share Your Idea', text: 'Tell us what you want to build in a few sentences. You can also upload a document or speak your idea.' },
  { title: 'Get Your Evaluation', text: 'SharkAI examines your idea across six key areas and scores each one.' },
  { title: 'Know What To Do Next', text: 'Review the results, follow the founder journey, and prepare your pitch.' }
];

const AREAS = ['Problem', 'Market', 'Competition', 'Difference', 'Growth', 'Revenue'];
const JOURNEY = ['Review', 'Validate', 'Build an MVP', 'Test', 'Refine & Price', 'Launch', 'Create your pitch'];

const AUDIENCE = [
  { title: 'Students', text: 'Test a class project or side idea before you commit time to building it.' },
  { title: 'First-Time Founders', text: 'Check your thinking early, before you spend money on the wrong product.' }
];

const FAQ = [
  { q: 'Is it free?', a: 'Yes. Creating an account and running evaluations is free. Each account has a daily limit.' },
  { q: 'What happens to my idea?', a: 'An AI service processes your idea to produce your report. The report is saved to your account, visible only to you, and you can delete it at any time.' },
  { q: 'Is the feedback guaranteed?', a: 'No. The results are AI guidance to help you think, not investment advice. They cannot promise that an idea will succeed or fail.' }
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
 * The public front page. Anyone can read it. Both "Evaluate My Idea" buttons lead to /evaluate, which asks visitors
 * to sign in first and, once they have, opens the Evaluate page directly.
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
        <p className="lp-lede rise d2">Share your idea and get a clear assessment of its potential, risks, and next steps.</p>
        <div className="lp-actions rise d3">
          <Link className="btn btn-primary" to="/evaluate"><span>Evaluate My Idea</span><Icon name="arrow" size={18} sw={2} /></Link>
          <a className="btn btn-ghost" href="#how-it-works" onClick={showHow}>See How It Works</a>
        </div>
      </header>

      <Section id="what" titleId="what-title" title="Turn an idea into a plan.">
        <div className="lp-prose">
          <p>SharkAI evaluates your startup idea before you build it.</p>
          <p className="lp-support"><span>It analyzes the problem, market, competition, and feasibility</span> <span>to show you where your idea stands and what to work on first.</span></p>
        </div>
      </Section>

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
          <article className="lp-card">
            <h3>6-Area Evaluation</h3>
            <p>Each area is scored and explained, so you can see where the idea is strong and where it needs work.</p>
            <ul className="lp-chips" aria-label="The six areas">
              {AREAS.map((a) => <li key={a} className="lp-chip">{a}</li>)}
            </ul>
          </article>
          <article className="lp-card">
            <h3>7-Stage Founder Journey</h3>
            <p>An ordered path from your first review to your pitch.</p>
            <ol className="lp-stages" aria-label="The seven stages">
              {JOURNEY.map((s, i) => (
                <li key={s}><span aria-hidden="true">{i + 1}</span>{s}</li>
              ))}
            </ol>
          </article>
          <article className="lp-card">
            <h3>Ready-to-Present Pitch</h3>
            <p>A short pitch written from your idea and results. Regenerate it, copy it, or download it.</p>
          </article>
        </div>
      </Section>

      <Section id="who" titleId="who-title" title="Who Is It For">
        <div className="lp-grid lp-who">
          {AUDIENCE.map((a) => (
            <article key={a.title} className="lp-card">
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="faq" titleId="faq-title" title="Frequently Asked Questions">
        <div className="lp-faq">
          {FAQ.map((f) => (
            <div key={f.q} className="lp-qa">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <section ref={ctaRef} className={`lp-final reveal${ctaSeen ? ' in' : ''}`} aria-labelledby="final-title">
        <div className="cta">
          <h2 id="final-title">Have an idea? Put it to the test.</h2>
          <Link className="btn btn-primary" to="/evaluate"><span>Evaluate My Idea</span><Icon name="arrow" size={18} sw={2} /></Link>
        </div>
      </section>
    </div>
  );
}
