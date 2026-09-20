import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { EvalProvider } from './context/EvalContext.jsx';
import './styles/global.css';
import './styles/refine.css';
import './styles/shell.css';

// Each account gets its own draft and report state; it resets when the account changes.
function Root() {
  const { user } = useAuth();
  return (
    <EvalProvider key={user?.id ?? 'anon'} userId={user?.id}>
      <App />
    </EvalProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
