import { Link, Navigate } from 'react-router-dom';
import { useEval } from '../context/EvalContext.jsx';
import Icon from '../components/Icon.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import { firstSentence, labelFor } from '../lib/format.js';
import { useInView } from '../hooks/useInView.js';

const ORDER = ['problem', 'market', 'competition', 'difference', 'growth', 'revenue'];

/** Builds a plain-text copy of the report for "Export report". */
function reportText(r, idea) {
  const lines = [`SharkAI evaluation`, '', `Idea: ${idea}`, '', `Overall score: ${r.overallScore}/100 (${labelFor(r.overallScore)})`, r.verdict, '', 'TOP 3 STRENGTHS'];
  r.strengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('', 'TOP 3 IMPROVEMENTS');
  r.improvements.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('', 'DETAILS');
  ORDER.forEach((k) => lines.push(`${r.evaluation[k].title} (${r.evaluation[k].businessTerm}): ${r.evaluation[k].score}/100. ${r.evaluation[k].description}`));
  lines.push('', 'NEXT STEPS');
  r.roadmap.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join('\n');
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Report() {
  const { result, analyzedIdea } = useEval();
  const [ctaRef, ctaSeen] = useInView();
  if (!result) return <Navigate to="/evaluate" replace />;

  const lowest = ORDER.slice().sort((a, b) => result.evaluation[a].score - result.evaluation[b].score).slice(0, 2)
    .map((k) => result.evaluation[k].businessTerm);

  return (
    <div className="wrap page-pad">
      <div className="page-head">
        <div>
          <h1>Your startup report</h1>
          <p>{firstSentence(analyzedIdea)}</p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" to="/evaluate" style={{ height: 46 }}><Icon name="refresh" size={16} /><span>Evaluate another idea</span></Link>
          <button type="button" className="btn btn-ghost" style={{ height: 46 }} onClick={() => download('sharkai-report.txt', reportText(result, analyzedIdea))}>
            <Icon name="download" size={16} /><span>Export report</span>
          </button>
        </div>
      </div>

      <section className="report-top">
        <div className="score-block">
          <div className="tw" tabIndex={0}>
            <ScoreRing score={result.overallScore} />
            <div className="tip wide solid" role="tooltip">
              <div className="tip-row"><strong>Why this score</strong><span>Your overall score blends the six questions below, so one strong area cannot hide a weak one. A real problem and clear demand lift it, while gaps in the weaker areas hold it back. Treat it as a guide to where your effort should go, not as a final verdict on the idea.</span></div>
              <div className="tip-row"><strong>Start with</strong><span>{lowest.join(' and ')}. Fixing the weakest area first usually raises the whole score the fastest.</span></div>
            </div>
          </div>
          <div className="score-meta">
            <span className="eyebrow">OVERALL SCORE</span>
            <span className="pill-gold">{labelFor(result.overallScore)}</span>
          </div>
        </div>
        <div className="mentor">
          <span className="eyebrow">MENTOR&apos;S TAKE</span>
          <p className="verdict">{result.verdict}</p>
        </div>
      </section>

      <div className="details-head">
        <h2>Details</h2>
        <p>Hover a card to see why it scored that way and how to improve it.</p>
      </div>
      <div className="grid3">
        {ORDER.map((k) => <QuestionCard key={k} data={result.evaluation[k]} />)}
      </div>

      <div ref={ctaRef} className={`cta reveal${ctaSeen ? ' in' : ''}`}>
        <div><h3>Ready for the next step?</h3><p>See what to do next, or turn your idea into a pitch.</p></div>
        <div className="row">
          <Link className="btn btn-ghost" to="/journey" style={{ height: 48 }}>See founder journey</Link>
          <Link className="btn btn-primary" to="/pitch"><span>Generate Pitch</span><Icon name="mic" size={18} sw={2} /></Link>
        </div>
      </div>
    </div>
  );
}