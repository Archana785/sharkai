import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useEval } from '../context/EvalContext.jsx';

const initials = (name) => (String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();

/** Profile avatar with a small dropdown: Dashboard, Saved Reports, Settings, Logout. */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const { clearAll } = useEval();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const trigger = useRef(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    clearAll(); // forget this account's draft and report on this device
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button ref={trigger} type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={() => setOpen((v) => !v)}>
        {initials(user.name)}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><strong>{user.name}</strong><span>{user.email}</span></div>
          <Link role="menuitem" to="/dashboard">Dashboard</Link>
          <Link role="menuitem" to="/saved">Saved Reports</Link>
          <Link role="menuitem" to="/settings">Settings</Link>
          <hr />
          <button type="button" role="menuitem" onClick={signOut}>Logout</button>
        </div>
      )}
    </div>
  );
}
