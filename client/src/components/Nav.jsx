import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AccountMenu from './AccountMenu.jsx';

const LINKS = [
  { to: '/evaluate', label: 'Evaluate' },
  { to: '/report', label: 'Report' },
  { to: '/journey', label: 'Journey' },
  { to: '/pitch', label: 'Pitch' }
];

export default function Nav() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // On the Evaluate page the button just brings you to the idea box.
  const focusIdea = (e) => {
    if (pathname !== '/evaluate') return;
    e.preventDefault();
    const box = document.getElementById('idea');
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box?.focus({ preventScroll: true });
  };

  return (
    <header className="nav">
      <Link className="brand" to="/" aria-label="SharkAI home">
        <span className="brand-mark">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#2BB5A6" d="M3 20.5C10 19 12 13 11.5 3c5 5 8.5 10 9.5 17.5z" /></svg>
        </span>
        <span className="brand-name">SharkAI</span>
      </Link>
      <nav className="nav-links" aria-label="Main">
        {LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
      </nav>
      <div className="nav-tools">
        <Link className="btn btn-primary nav-cta" to="/evaluate" onClick={focusIdea}>Evaluate Idea</Link>
        {user ? <AccountMenu /> : <Link className="btn btn-ghost nav-signin" to="/login">Sign In</Link>}
      </div>
    </header>
  );
}
