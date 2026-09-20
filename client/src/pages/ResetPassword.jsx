import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api.js';
import { AuthCard, FormAlert, PasswordField, authErrorMessage } from '../components/AuthUI.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return <AuthCard title="This link is not valid" subtitle="Please request a new password reset link." footer={<Link className="link" to="/forgot-password">Request a new link</Link>} />;
  }
  if (done) {
    return <AuthCard title="Password updated" subtitle="You can now sign in with your new password." footer={<Link className="link" to="/login">Go to Sign In</Link>} />;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirm !== password) next.confirm = 'The passwords do not match.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await authApi.reset(token, password);
      setDone(true);
    } catch (err) {
      const m = authErrorMessage(err);
      setErrors(m.fields);
      setFormError(m.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" subtitle="Pick something you have not used before.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormAlert>{formError}</FormAlert>
        <PasswordField id="password" label="New password" autoComplete="new-password" value={password} error={errors.password} hint="Use at least 8 characters." onChange={(e) => setPassword(e.target.value)} autoFocus />
        <PasswordField id="confirm" label="Confirm password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" className={`btn btn-primary btn-block${busy ? ' is-loading' : ''}`} disabled={busy} aria-busy={busy}>
          <span className="btn-spinner" aria-hidden="true" />
          <span className="btn-label">{busy ? 'Saving...' : 'Update password'}</span>
        </button>
      </form>
    </AuthCard>
  );
}
