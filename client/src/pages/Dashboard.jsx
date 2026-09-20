import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useEval } from '../context/EvalContext.jsx';
import { reportsApi } from '../lib/api.js';
import ReportRow from '../components/ReportRow.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { openReport } = useEval();
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    reportsApi.list()
      .then((r) => { if (live) setReports(r.reports); })
      .catch((err) => { console.error('[SharkAI] could not load reports:', err); if (live) setReports([]); });
    return () => { live = false; };
  }, []);

  const open = async (id) => {
    setError('');
    try {
      const { report } = await reportsApi.get(id);
      openReport({ idea: report.idea, result: report.result });
      navigate('/report');
    } catch (err) {
      console.error('[SharkAI] could not open report:', err);
      setError("We couldn't open that report. Please try again.");
    }
  };

  const first = user.name.split(' ')[0];
  const recent = (reports || []).slice(0, 3);
  return (
    <div className="wrap acct">
      <header className="acct-head">
        <h1>Welcome back, {first}.</h1>
        <p>Pick up where you left off, or evaluate something new.</p>
      </header>
      <div className="acct-actions">
        <Link className="btn btn-primary" to="/">Evaluate a new idea</Link>
        <Link className="btn btn-ghost" style={{ height: 48 }} to="/saved">All saved reports</Link>
      </div>
      <section aria-labelledby="recent-title">
        <h2 id="recent-title" className="acct-sub">Recent reports</h2>
        {error && <div className="auth-alert" role="alert">{error}</div>}
        {reports === null && <div className="splash small"><span className="spinner" aria-label="Loading" /></div>}
        {reports && recent.length === 0 && <div className="empty-card"><p>Your evaluations will show up here.</p></div>}
        {recent.length > 0 && <ul className="rlist">{recent.map((r) => <ReportRow key={r.id} report={r} onOpen={() => open(r.id)} />)}</ul>}
      </section>
    </div>
  );
}
