import { Link } from 'react-router-dom';

// Replace these with your real profiles.
const SOCIAL = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { label: 'GitHub', href: 'https://github.com/' },
  { label: 'Email', href: 'mailto:hello@example.com' }
];
const QUICK = [
  { to: '/evaluate', label: 'Evaluate' },
  { to: '/report', label: 'Report' },
  { to: '/journey', label: 'Journey' },
  { to: '/pitch', label: 'Pitch' }
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="brand" to="/" aria-label="SharkAI home">
              <span className="brand-mark">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#2BB5A6" d="M3 20.5C10 19 12 13 11.5 3c5 5 8.5 10 9.5 17.5z" /></svg>
              </span>
              <span className="brand-name">SharkAI</span>
            </Link>
            <p>Know if your startup idea is worth building.</p>
          </div>
          <nav className="footer-col footer-mid" aria-label="Quick links">
            <h4>Quick links</h4>
            <ul>{QUICK.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}</ul>
          </nav>
          <div className="footer-col footer-end">
            <h4>Connect</h4>
            <ul>{SOCIAL.map((s) => <li key={s.label}><a href={s.href} {...(s.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{s.label}</a></li>)}</ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SharkAI. All rights reserved.</span>
          <span><a href="#">Privacy Policy</a> <i aria-hidden="true">•</i> <a href="#">Terms of Service</a></span>
        </div>
      </div>
    </footer>
  );
}
