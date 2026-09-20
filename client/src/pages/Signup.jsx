import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthCard, EMAIL_RE, Field, FormAlert, PasswordField, authErrorMessage } from '../components/AuthUI.jsx';

export default function Signup() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (form.confirm !== form.password) next.confirm = 'The passwords do not match.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      const m = authErrorMessage(err);
      setErrors(m.fields);
      setFormError(m.form);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Save your reports and pick up where you left off."
      footer={<>Already have an account? <Link className="link" to="/login">Sign in.</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormAlert>{formError}</FormAlert>
        <Field id="name" label="Full name" autoComplete="name" placeholder="Your full name" value={form.name} error={errors.name} onChange={set('name')} autoFocus />
        <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} error={errors.email} onChange={set('email')} />
        <PasswordField id="password" label="Password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} error={errors.password} hint="Use at least 8 characters." onChange={set('password')} />
        <PasswordField id="confirm" label="Confirm password" autoComplete="new-password" placeholder="Type it again" value={form.confirm} error={errors.confirm} onChange={set('confirm')} />
        <button type="submit" className={`btn btn-primary btn-block${busy ? ' is-loading' : ''}`} disabled={busy} aria-busy={busy}>
          <span className="btn-spinner" aria-hidden="true" />
          <span className="btn-label">{busy ? 'Creating account...' : 'Create Account'}</span>
        </button>
      </form>
    </AuthCard>
  );
}
