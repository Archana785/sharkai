import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/**
 * Who is signed in.
 *   user     { id, name, email } or null
 *   loading  true only while the first "who am I?" request runs
 * `initialUser` is for tests and skips that request.
 */
export function AuthProvider({ children, initialUser }) {
  const [user, setUser] = useState(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  useEffect(() => {
    if (initialUser !== undefined) return undefined;
    let live = true;
    authApi.me()
      .then((r) => { if (live) setUser(r.user || null); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [initialUser]);

  // The server says the session ended (for example after a password change on another device).
  useEffect(() => {
    const onEnd = () => setUser(null);
    window.addEventListener('sharkai:unauthorized', onEnd);
    return () => window.removeEventListener('sharkai:unauthorized', onEnd);
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const r = await authApi.login({ email, password, remember: !!remember });
    setUser(r.user);
    return r.user;
  }, []);
  const register = useCallback(async (data) => {
    const r = await authApi.register(data);
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* the cookie is cleared client-side state anyway */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
