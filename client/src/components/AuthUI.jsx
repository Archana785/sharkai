import { useState } from 'react';

/** The centered card every sign-in style page uses. */
export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card rise d1">
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {footer && <p className="auth-foot">{footer}</p>}
      </div>
    </div>
  );
}

/** A labelled input with an inline error or hint. */
export function Field({ id, label, error, hint, right, children, ...input }) {
  const note = error || hint;
  return (
    <div className="field">
      <div className="field-top">
        <label htmlFor={id}>{label}</label>
        {right}
      </div>
      <div className="field-box">
        <input id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={note ? `${id}-note` : undefined} {...input} />
        {children}
      </div>
      {note && <p id={`${id}-note`} className={error ? 'field-error' : 'field-hint'}>{note}</p>}
    </div>
  );
}

export function PasswordField(props) {
  const [show, setShow] = useState(false);
  return (
    <Field {...props} type={show ? 'text' : 'password'}>
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </Field>
  );
}

export function FormAlert({ children }) {
  return children ? <div className="auth-alert" role="alert">{children}</div> : null;
}

/** Turns any API failure into friendly text for a form: { form, fields }. Technical details are only logged. */
export function authErrorMessage(err) {
  console.error('[SharkAI] account request failed:', err);
  if (err?.fields && Object.keys(err.fields).length) return { form: '', fields: err.fields };
  const byCode = {
    INVALID_CREDENTIALS: 'That email or password is not correct.',
    RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
    NETWORK: "We can't reach SharkAI right now. Please try again in a moment.",
    INVALID_TOKEN: 'This reset link has expired or was already used. Please request a new one.',
    EMAIL_TAKEN: 'An account with this email already exists. Try signing in instead.'
  };
  return { form: byCode[err?.code] || 'Something went wrong. Please try again in a moment.', fields: {} };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
