import { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.me().then((d) => setUser(d.user)).catch(() => {}).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="splash" aria-busy="true" />;
  if (!user) return <AuthPage onAuthed={setUser} />;

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };
  return <Dashboard user={user} onLogout={logout} />;
}
