import { useState } from 'react';
import { authApi } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, FormAlert, PasswordField, authErrorMessage } from '../components/AuthUI.jsx';

function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setNote(''); setError('');
    if (name.trim().length < 2) { setError('Please enter your full name.'); return; }
    setBusy(true);
    try {
      const r = await authApi.updateName(name.trim());
      setUser(r.user);
      setNote('Saved.');
    } catch (err) {
      const m = authErrorMessage(err);
      setError(m.fields.name || m.form);
    } finally { setBusy(false); }
  };
  return (
    <form className="card-lite" onSubmit={save} noValidate>
      <h2>Profile</h2>
      <Field id="name" label="Full name" autoComplete="name" value={name} error={error} onChange={(e) => setName(e.target.value)} />
      <Field id="email" label="Email" value={user.email} readOnly hint="Your email is used to sign in." />
      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
        {note && <span className="saved-note" role="status">{note}</span>}
      </div>
    </form>
  );
}

function Password() {
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setNote(''); setFormError('');
    const next = {};
    if (!f.current) next.current = 'Enter your current password.';
    if (f.password.length < 8) next.password = 'Use at least 8 characters.';
    if (f.confirm !== f.password) next.confirm = 'The passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await authApi.changePassword(f.current, f.password);
      setF({ current: '', password: '', confirm: '' });
      setNote('Password updated.');
    } catch (err) {
      const m = authErrorMessage(err);
      setErrors(m.fields); setFormError(m.form);
    } finally { setBusy(false); }
  };
  return (
    <form className="card-lite" onSubmit={save} noValidate>
      <h2>Password</h2>
      <FormAlert>{formError}</FormAlert>
      <PasswordField id="current" label="Current password" autoComplete="current-password" value={f.current} error={errors.current} onChange={set('current')} />
      <PasswordField id="password" label="New password" autoComplete="new-password" value={f.password} error={errors.password} hint="Use at least 8 characters." onChange={set('password')} />
      <PasswordField id="confirm" label="Confirm new password" autoComplete="new-password" value={f.confirm} error={errors.confirm} onChange={set('confirm')} />
      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
        {note && <span className="saved-note" role="status">{note}</span>}
      </div>
    </form>
  );
}

export default function Settings() {
  return (
    <div className="wrap acct">
      <header className="acct-head">
        <h1>Settings</h1>
        <p>Manage your profile and password.</p>
      </header>
      <div className="acct-stack">
        <Profile />
        <Password />
      </div>
    </div>
  );
}
