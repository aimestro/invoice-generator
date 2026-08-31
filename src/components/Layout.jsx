import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/invoices', label: 'Invoices', icon: '🧾' },
  { to: '/time-entries', label: 'Time Entries', icon: '⏱️' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const { user, setUser } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.get('/api/settings').then((s) => setBusinessName(s.business_name || 'Invoice Studio')).catch(() => {});
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setShowUserMenu(false);
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="sidebar-brand">
          <span className="brand-icon">🧾</span>
          <div>
            <div className="brand-name">{businessName || 'Invoice Studio'}</div>
            <div className="brand-sub">Invoice Studio</div>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="sidebar-foot user-menu">
            <button className="user-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span>👤 {user.name}</span>
              <span className="chevron">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-email">{user.email}</div>
                <button className="btn danger" style={{width: '100%', textAlign: 'left'}} onClick={handleLogout}>Logout</button>
              </div>
            )}
            <div className="muted small" style={{marginTop: 8, padding: '0 12px'}}>Local-first · your data stays on this machine</div>
          </div>
        )}
        {!user && <div className="sidebar-foot">Local-first · your data stays on this machine</div>}
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
