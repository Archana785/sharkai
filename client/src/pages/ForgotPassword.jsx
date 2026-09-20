import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api.js';
import { AuthCard, EMAIL_RE, Field, FormAlert, authErrorMessage } from '../components/AuthUI.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    if (!EMAIL_RE.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setError('');
    setBusy(true);
    try {
      await authApi.forgot(email.trim());
      setSent(true);
    } catch (err) {
      const m = authErrorMessage(err);
      setError(m.fields.email || '');
      setFormError(m.form);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={`If an account exists for ${email.trim()}, we will send a link to reset your password.`} footer={<Link className="link" to="/login">Back to Sign In</Link>} />
    );
  }
  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we will send you a reset link." footer={<Link className="link" to="/login">Back to Sign In</Link>}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormAlert>{formError}</FormAlert>
        <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} error={error} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <button type="submit" className={`btn btn-primary btn-block${busy ? ' is-loading' : ''}`} disabled={busy} aria-busy={busy}>
          <span className="btn-spinner" aria-hidden="true" />
          <span className="btn-label">{busy ? 'Sending...' : 'Send reset link'}</span>
        </button>
      </form>
    </AuthCard>
  );
}
