import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Background from './components/Background.jsx';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Home from './pages/Home.jsx';
import Report from './pages/Report.jsx';
import Journey from './pages/Journey.jsx';
import Pitch from './pages/Pitch.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SavedReports from './pages/SavedReports.jsx';
import Settings from './pages/Settings.jsx';

const TITLES = {
  '/': 'SharkAI: Know if your startup idea is worth building',
  '/evaluate': 'Evaluate your idea — SharkAI',
  '/report': 'Your report — SharkAI',
  '/journey': 'Founder journey — SharkAI',
  '/pitch': 'Your pitch — SharkAI',
  '/login': 'Sign in — SharkAI',
  '/signup': 'Create your account — SharkAI',
  '/forgot-password': 'Reset your password — SharkAI',
  '/reset-password': 'Choose a new password — SharkAI',
  '/dashboard': 'Dashboard — SharkAI',
  '/saved': 'Saved reports — SharkAI',
  '/settings': 'Settings — SharkAI'
};

function PageChrome() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] || TITLES['/'];
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const Splash = () => <div className="splash"><span className="spinner" aria-label="Loading" /></div>;

/** Everything except the landing page and the sign-in pages needs an account. */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? children : <Navigate to="/login" replace />;
}

/** Sign-in pages are only for signed-out visitors; signed-in users go to the Evaluate page. */
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to="/evaluate" replace /> : children;
}

const protect = (el) => <RequireAuth>{el}</RequireAuth>;
const guest = (el) => <GuestOnly>{el}</GuestOnly>;

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <Background />
      <PageChrome />
      <Nav />
      <main id="main" key={pathname} className="view active">
        <Routes>
          <Route path="/login" element={guest(<Login />)} />
          <Route path="/signup" element={guest(<Signup />)} />
          <Route path="/forgot-password" element={guest(<ForgotPassword />)} />
          <Route path="/reset-password" element={guest(<ResetPassword />)} />
          <Route path="/" element={<Landing />} />
          <Route path="/evaluate" element={protect(<Home />)} />
          <Route path="/report" element={protect(<Report />)} />
          <Route path="/journey" element={protect(<Journey />)} />
          <Route path="/pitch" element={protect(<Pitch />)} />
          <Route path="/dashboard" element={protect(<Dashboard />)} />
          <Route path="/saved" element={protect(<SavedReports />)} />
          <Route path="/settings" element={protect(<Settings />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
