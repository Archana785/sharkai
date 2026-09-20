import { EXAMPLES } from '../lib/examples.js';

/** "Try an example startup": one click fills the idea box. Plain text chips, no emojis. */
export default function Examples({ onPick, disabled = false }) {
  return (
    <div className="examples rise d5">
      <span className="lead">Try an example startup</span>
      <div className="example-list">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="example-chip" disabled={disabled} onClick={() => onPick(ex.text)}>
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}