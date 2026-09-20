import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEval } from '../context/EvalContext.jsx';
import { generatePitch } from '../lib/api.js';
import { countWords, formatTime, speakingSeconds } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = Object.assign(document.createElement('textarea'), { value: text });
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
  return undefined;
}

/** One natural speech, with speaking time and word count. Nothing else. */
export default function Pitch() {
  const { result, analyzedIdea, updatePitch } = useEval();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const variant = useRef(0);
  const ctrl = useRef(null);
  const started = useRef(false);

  const pitch = result?.pitch || '';

  const write = async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError('');
    variant.current += 1;
    try {
      const res = await generatePitch({ idea: analyzedIdea, strengths: result.strengths, improvements: result.improvements, variant: variant.current }, c.signal);
      if (!c.signal.aborted) updatePitch(res.pitch);
    } catch (err) {
      if (!c.signal.aborted && err?.name !== 'AbortError') setError(err.message || 'The pitch could not be written. Please try again.');
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  };

  // If the evaluation came back without a usable pitch, write one now.
  useEffect(() => {
    if (result && !result.pitch && !started.current) { started.current = true; write(); }
    return () => ctrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!result) return <Navigate to="/" replace />;

  const words = countWords(pitch);
  const showText = pitch && !loading;

  const copy = async () => {
    try { await copyToClipboard(pitch); setCopied('Copied'); } catch { setCopied('Press Ctrl+C'); }
    setTimeout(() => setCopied(''), 1800);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([pitch], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'sharkai-pitch.txt' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="wrap pitch-wrap">
      <h1>Your pitch</h1>
      <div className="pitch-border">
        <div className="pitch-card">
          {showText && (
            <div className="stats">
              <span className="tw stat time" tabIndex={0}>
                <Icon name="clock" size={16} sw={2} />
                <span>About {formatTime(speakingSeconds(words))} to say</span>
                <span className="tip" role="tooltip">Estimated at a calm speaking pace of about 130 words per minute.</span>
              </span>
              <span className="stat words">{words} words</span>
            </div>
          )}
          {loading && (
            <div className="skeleton" role="status" aria-label="Writing your pitch">
              <i style={{ width: '96%' }} /><i style={{ width: '100%' }} /><i style={{ width: '92%' }} /><i style={{ width: '98%' }} /><i style={{ width: '60%' }} />
            </div>
          )}
          {showText && <p className="pitch-text">{pitch}</p>}
          {error && <p className="field-msg" role="alert" style={{ marginTop: 0 }}>{error}</p>}
          <div className="pitch-actions">
            <button type="button" className="btn btn-primary" style={{ minWidth: 0 }} onClick={copy} disabled={!showText}>
              <Icon name="copy" size={18} sw={2} /><span>{copied || 'Copy'}</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={download} disabled={!showText}><Icon name="download" size={16} /><span>Download</span></button>
            <button type="button" className="btn btn-ghost" onClick={write} disabled={loading}><Icon name="refresh" size={16} /><span>Regenerate</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}
