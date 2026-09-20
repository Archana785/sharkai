import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { reportsApi } from '../lib/api.js';
import { useEval } from '../context/EvalContext.jsx';
import ReportRow from '../components/ReportRow.jsx';

export default function SavedReports() {
  const { openReport } = useEval();
  const navigate = useNavigate();
  const [reports, setReports] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    reportsApi.list()
      .then((r) => { if (live) setReports(r.reports); })
      .catch((err) => { console.error('[SharkAI] could not load reports:', err); if (live) { setReports([]); setError("We couldn't load your reports right now. Please try again in a moment."); } });
    return () => { live = false; };
  }, []);

  const open = async (id) => {
    setBusy(true); setError('');
    try {
      const { report } = await reportsApi.get(id);
      openReport({ idea: report.idea, result: report.result });
      navigate('/report');
    } catch (err) {
      console.error('[SharkAI] could not open report:', err);
      setError("We couldn't open that report. Please try again.");
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setError('');
    try {
      await reportsApi.remove(id);
      setReports((list) => list.filter((r) => r.id !== id));
      setConfirm(null);
    } catch (err) {
      console.error('[SharkAI] could not delete report:', err);
      setError("We couldn't delete that report. Please try again.");
    }
  };

  return (
    <div className="wrap acct">
      <header className="acct-head">
        <h1>Saved Reports</h1>
        <p>Every evaluation is saved here automatically.</p>
      </header>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      {reports === null && <div className="splash small"><span className="spinner" aria-label="Loading" /></div>}
      {reports && reports.length === 0 && !error && (
        <div className="empty-card">
          <h2>No saved reports yet</h2>
          <p>Evaluate an idea and its report will appear here.</p>
          <Link className="btn btn-primary" to="/">Evaluate an idea</Link>
        </div>
      )}
      {reports && reports.length > 0 && (
        <ul className="rlist">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} busy={busy} onOpen={() => open(r.id)}
              confirming={confirm === r.id} onAskDelete={() => setConfirm(r.id)} onCancelDelete={() => setConfirm(null)} onDelete={() => remove(r.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
