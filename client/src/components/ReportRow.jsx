import { labelFor, tone } from '../lib/format.js';

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** One saved report in a list: idea, date, score, and actions. */
export default function ReportRow({ report, onOpen, onDelete, confirming, onAskDelete, onCancelDelete, busy }) {
  const t = tone(report.overallScore ?? 0);
  return (
    <li className="rrow">
      <div className="rrow-main">
        <p className="rrow-idea">{report.idea}</p>
        <span className="rrow-date">{fmt(report.createdAt)}</span>
      </div>
      <div className="rrow-score">
        <b style={{ color: t.color }}>{report.overallScore ?? '–'}</b>
        <span>{report.overallScore == null ? '' : labelFor(report.overallScore)}</span>
      </div>
      <div className="rrow-actions">
        <button type="button" className="btn btn-ghost" style={{ height: 40 }} onClick={onOpen} disabled={busy}>Open</button>
        {onDelete && (confirming ? (
          <>
            <button type="button" className="btn btn-quiet" style={{ height: 40 }} onClick={onCancelDelete}>Cancel</button>
            <button type="button" className="btn btn-danger" style={{ height: 40 }} onClick={onDelete}>Yes, delete</button>
          </>
        ) : (
          <button type="button" className="btn btn-quiet" style={{ height: 40 }} onClick={onAskDelete} aria-label={`Delete report: ${report.idea.slice(0, 40)}`}>Delete</button>
        ))}
      </div>
    </li>
  );
}
