import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEval } from '../context/EvalContext.jsx';
import { extractFile } from '../lib/api.js';
import { useSpeech } from '../hooks/useSpeech.js';
import Icon from './Icon.jsx';

// Small status line under the buttons while the AI works. Only this line changes; the rest of the card stays put.
const STATUS = [
  'Analyzing your startup idea',
  'Understanding your idea',
  'Looking at similar businesses',
  'Checking market demand',
  'Evaluating what makes it different',
  'Writing your report'
];

const PLACEHOLDER =
  'Example: I want to build a café where students can study comfortably while enjoying affordable food and drinks. ' +
  "Tell us who it's for, what problem it solves, and what makes it different.";

// Users only ever see these friendly messages. Technical details go to the browser console.
const GENERIC_ERROR = "We couldn't analyze your idea right now. Please try again in a few moments.";
const FRIENDLY = {
  TIMEOUT: 'This is taking longer than usual. Please try again in a few moments.',
  RATE_LIMITED: 'You are going a little fast. Please wait a minute and try again.',
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  AI_BUSY: 'Our AI is very busy right now. Please try again in a minute.'
};
const SAFE_TO_SHOW = new Set(['IDEA_TOO_SHORT', 'IDEA_TOO_LONG', 'DAILY_LIMIT']);
const SAFE_FILE_ERRORS = new Set(['UNSUPPORTED_FILE', 'UNREADABLE_FILE', 'EMPTY_FILE', 'FILE_TOO_LARGE', 'NO_FILE']);

const friendlyMessage = (err) => (SAFE_TO_SHOW.has(err?.code) ? err.message : FRIENDLY[err?.code] || GENERIC_ERROR);
const friendlyFileMessage = (err) =>
  SAFE_FILE_ERRORS.has(err?.code) ? err.message : "We couldn't read that file. Please try another one, or paste the text instead.";

/** Icon-only button with a tooltip. */
function ToolButton({ label, tip, icon, onClick, pressed, disabled }) {
  return (
    <div className="tw">
      <button type="button" className="icon-tool" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
        <Icon name={icon} size={20} />
      </button>
      <span className="tip sm left" role="tooltip">{tip}</span>
    </div>
  );
}

/** One quiet line that changes every two seconds while the analysis runs. */
function StatusLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STATUS.length - 1)), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="status-line" role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text" key={i}>{STATUS[i]}...</span>
    </p>
  );
}

/** Small inline message with a retry button. It never replaces the page. */
function InlineError({ error, onRetry }) {
  return (
    <div className="inline-error" role="alert">
      <svg className="i" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></svg>
      <span>{friendlyMessage(error)}</span>
      <button type="button" className="retry" onClick={onRetry}>Try again</button>
    </div>
  );
}

export default function Workspace() {
  const { idea, setIdea, phase, error, evaluate, reset } = useEval();
  const navigate = useNavigate();
  const [msg, setMsg] = useState({ text: '', kind: 'warn' });
  const [shake, setShake] = useState(false);
  const [reading, setReading] = useState(false);
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const ideaRef = useRef(idea);
  ideaRef.current = idea;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const warn = useCallback((text) => setMsg({ text, kind: 'warn' }), []);
  const speech = useSpeech({ getText: () => ideaRef.current, onText: setIdea, onMessage: warn });
  const loading = phase === 'loading';
  const failed = phase === 'error';

  // Run the evaluation, then go straight to the report (unless the user has already left this page).
  const run = async () => {
    const ok = await evaluate();
    if (ok && alive.current) navigate('/report');
  };

  const submit = () => {
    if (loading) return;
    if (idea.trim().length < 15) {
      warn('Add a sentence or two about your idea first.');
      areaRef.current?.focus();
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    speech.stop();
    setMsg({ text: '', kind: 'warn' });
    run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (/\.(txt|md)$/i.test(file.name)) {
        setIdea((await file.text()).slice(0, 4000));
        setMsg({ text: `Loaded ${file.name}. You can edit it before evaluating.`, kind: 'info' });
      } else {
        setReading(true);
        setMsg({ text: 'Reading your file...', kind: 'info' });
        const { text, truncated } = await extractFile(file);
        setIdea(text);
        setMsg({ text: truncated ? 'Loaded the first part of your file. You can edit it before evaluating.' : `Loaded ${file.name}. You can edit it before evaluating.`, kind: 'info' });
      }
    } catch (err) {
      console.error('[SharkAI] file upload failed:', err);
      warn(friendlyFileMessage(err));
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="ws-wrap rise d4">
      <div className="ws-border">
        <div className="ws">
          <textarea
            id="idea"
            ref={areaRef}
            className={`${shake ? 'shake' : ''}${loading ? ' is-busy' : ''}`.trim()}
            aria-label="Describe your startup idea"
            aria-busy={loading}
            maxLength={4000}
            placeholder={PLACEHOLDER}
            value={idea}
            readOnly={loading}
            onChange={(e) => {
              setIdea(e.target.value);
              if (msg.text) setMsg({ text: '', kind: 'warn' });
              if (failed) reset();
            }}
            onKeyDown={onKeyDown}
          />
          <p className={`field-msg${msg.kind === 'info' ? ' info' : ''}`} role="status">{msg.text}</p>

          <div className="ws-foot">
            <div className="tools">
              <ToolButton label="Upload File" tip="Upload your pitch deck" icon="paperclip" disabled={reading || loading} onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} type="file" accept=".pdf,.pptx,.docx,.txt,.md" hidden onChange={onFile} />
              <ToolButton
                label="Voice Input"
                tip={speech.supported ? (speech.listening ? 'Listening… click to stop' : 'Speak your startup idea') : 'Voice input is not supported in this browser'}
                icon="mic"
                pressed={speech.listening}
                disabled={loading}
                onClick={speech.toggle}
              />
            </div>
            <button type="button" className={`btn btn-primary${loading ? ' is-loading' : ''}`} onClick={submit} disabled={loading} aria-busy={loading}>
              <span className="btn-spinner" aria-hidden="true" />
              <span className="btn-label">{loading ? 'Analyzing...' : 'Evaluate Idea'}</span>
              <span className="btn-arrow"><Icon name="arrow" size={18} sw={2} /></span>
            </button>
          </div>

          {loading && <StatusLine />}
          {failed && <InlineError error={error} onRetry={run} />}
        </div>
      </div>
    </div>
  );
}
