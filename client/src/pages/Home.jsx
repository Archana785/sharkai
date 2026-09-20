import { useEval } from '../context/EvalContext.jsx';
import Workspace from '../components/Workspace.jsx';
import Examples from '../components/Examples.jsx';
import HowItWorks from '../components/HowItWorks.jsx';

export default function Home() {
  const { setIdea, reset, phase } = useEval();
  const busy = phase === 'loading';

  // One click on an example fills the box (and clears any old error). Ignored while an evaluation is running.
  const pick = (text) => {
    if (busy) return;
    reset();
    setIdea(text);
    requestAnimationFrame(() => document.getElementById('idea')?.focus({ preventScroll: true }));
  };

  return (
    <div className="wrap">
      <div className="hero">
        <h1 className="rise d1">Know if your startup idea is worth building.</h1>
        <p className="lede rise d2">Get honest, simple feedback, like talking to an experienced startup mentor.</p>
        <Workspace />
        <Examples onPick={pick} disabled={busy} />
      </div>
      <HowItWorks />
    </div>
  );
}