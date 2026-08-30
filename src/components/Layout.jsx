import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/invoices', label: 'Invoices', icon: '🧾' },
  { to: '/time-entries', label: 'Time Entries', icon: '⏱️' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const [businessName, setBusinessName] = useState('');
  const location = useLocation();

  useEffect(() => {
    api.get('/api/settings').then((s) => setBusinessName(s.business_name || 'Invoice Studio')).catch(() => {});
  }, [location.pathname]);

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
        <div className="sidebar-foot">Local-first · your data stays on this machine</div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
