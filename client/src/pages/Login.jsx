import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthCard, EMAIL_RE, Field, FormAlert, PasswordField, authErrorMessage } from '../components/AuthUI.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await login(email.trim(), password, remember); // the page then sends you to the homepage
    } catch (err) {
      const m = authErrorMessage(err);
      setErrors(m.fields);
      setFormError(m.form);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to evaluate your startup idea."
      footer={<>Don&apos;t have an account? <Link className="link" to="/signup">Create one.</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormAlert>{formError}</FormAlert>
        <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <PasswordField id="password" label="Password" autoComplete="current-password" placeholder="Your password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
        <div className="auth-row">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember me</span></label>
          <Link className="link" to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className={`btn btn-primary btn-block${busy ? ' is-loading' : ''}`} disabled={busy} aria-busy={busy}>
          <span className="btn-spinner" aria-hidden="true" />
          <span className="btn-label">{busy ? 'Signing in...' : 'Sign In'}</span>
        </button>
        <div className="auth-or"><span>or</span></div>
        <Link className="btn btn-ghost btn-block" to="/signup" style={{ height: 48 }}>Create Account</Link>
      </form>
    </AuthCard>
  );
}
