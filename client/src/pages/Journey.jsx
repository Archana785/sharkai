import { Link, Navigate } from 'react-router-dom';
import { useEval } from '../context/EvalContext.jsx';
import Icon from '../components/Icon.jsx';
import { labelFor } from '../lib/format.js';

/** The first sentence (or two) of a piece of advice, so a stage can point at the founder's own report. */
const firstSentences = (text, n = 1) => (String(text || '').match(/[^.!?]+[.!?]+/g) || []).slice(0, n).join(' ').trim();

/** One line from the report that belongs to this stage, or nothing when the report has no advice for it. */
const fromReport = (result, key) => {
  const area = result.evaluation[key];
  const tip = firstSentences(area?.insight);
  return tip ? ` In your report, ${area.businessTerm} scored ${area.score}. ${tip}` : '';
};

/** Stage 0 explains the report itself, using the founder's own scores. */
function reviewText(result) {
  const areas = Object.values(result.evaluation);
  const best = areas.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = areas.reduce((a, b) => (b.score < a.score ? b : a));
  return `Start by reading your evaluation to understand your strengths, weaknesses, market potential, risks and opportunities. Your overall score is ${result.overallScore} out of 100, which we call "${labelFor(result.overallScore).toLowerCase()}". Your strongest area is ${best.businessTerm} at ${best.score}, and the area that needs the most work is ${worst.businessTerm} at ${worst.score}. You are ready to move on when you can explain in one minute why your idea should work and where it could fail.`;
}

/**
 * The founder journey, in order. `area` is the part of the report whose advice is added to that stage.
 * Every card is a proper paragraph: what the stage is, why it matters, what to do, and what success looks like.
 */
const STAGES = [
  { icon: 'flag', title: 'Review your evaluation', now: true },
  {
    icon: 'users', title: 'Validate', area: 'problem',
    text: 'Validating means testing the problem with real people before you build anything. Most startups fail because nobody really needed what they made. Talk to 20 to 30 people who match your target customer. Ask what they do today, what frustrates them and what they already pay for. It worked when most of them describe the same problem in their own words.'
  },
  {
    icon: 'layers', title: 'Build an MVP', area: 'difference',
    text: 'An MVP is the simplest version of your solution that still solves the main problem. Building small costs little and teaches you fast. Pick the one feature customers care about most and build only that. Use simple tools, a prototype, or even a manual process behind the scenes. It worked when a real person can use it from start to finish without your help.'
  },
  {
    icon: 'problem', title: 'Test', area: 'market',
    text: 'Testing means putting your MVP in front of real users and watching what happens. What people do is more honest than what they say. Let 10 to 20 people try it, note where they get stuck, and ask what they would change. Sort every problem by how often it comes up. It worked when you have a clear list of the top three things to fix.'
  },
  {
    icon: 'money', title: 'Refine & Price', area: 'revenue',
    text: 'Now improve the product using the feedback, then find out if people will pay for it. Interest is not income. Fix the top problems, then show real prices to your testers, such as two or three options, and see who actually pays. It worked when a good share of testers say yes and your price covers your costs.'
  },
  {
    icon: 'growth', title: 'Launch', area: 'growth',
    text: 'Launching means opening your product to real customers and starting to win them. Your idea only becomes a business once people use it again and again. Start with a small group in one place, such as one college or one neighbourhood. Track how many sign up and come back, and learn which channel brings the best customers. It worked when new customers keep arriving and many return.'
  },
  { icon: 'mic', title: 'Create your pitch', pitch: true }
];

const PITCH_TEXT = 'SharkAI turns your validated idea, your results and your business potential into a clear pitch for investors. A good pitch tells the whole story in about two minutes. Open Generate Pitch, read the first version out loud, and swap general lines for real numbers and quotes from your tests. It worked when you can say it without notes and a stranger can explain your idea back to you.';

/** A horizontal journey with seven stages. Hover (or focus) a stage to read what it means. */
export default function Journey() {
  const { result } = useEval();
  if (!result) return <Navigate to="/" replace />;

  const stages = STAGES.map((s) => {
    if (s.now) return { ...s, body: reviewText(result) };
    if (s.pitch) return { ...s, body: `${PITCH_TEXT}${result.strengths?.[0] ? ` A strong point to open with: ${result.strengths[0]}` : ''}` };
    return { ...s, body: `${s.text}${fromReport(result, s.area)}` };
  });

  return (
    <div className="wrap page-pad">
      <div className="journey-head">
        <span className="eyebrow-teal">FOUNDER JOURNEY</span>
        <h1 className="title-xl">Your next steps.</h1>
        <p className="sub">Hover a stage to see what it means.</p>
      </div>
      <div className="road">
        <ol className="steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {stages.map((s, i) => (
            <li className="step" key={s.title}>
              <div className="tw">
                <button type="button" className={`node${s.now ? ' now' : ''}`} aria-label={s.title}><Icon name={s.icon} size={24} sw={s.now ? 2 : 1.6} /></button>
                <div className="tip step-tip" role="tooltip"><b>{s.title}</b><span>{s.body}</span></div>
              </div>
              <div>
                <span className={`k${s.now ? ' now' : ''}`}>{s.now ? 'TODAY' : `STEP ${i}`}</span>
                <div className="n">{s.title}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="road-actions">
        <Link className="btn btn-ghost" to="/report" style={{ height: 48 }}>Back to report</Link>
        <Link className="btn btn-primary" to="/pitch"><span>Generate Pitch</span><Icon name="mic" size={18} sw={2} /></Link>
      </div>
    </div>
  );
}