import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../hooks/useOrders';

const NAV = [
  { to: '/', num: '00', label: 'Panel de control', end: true },
  { to: '/subir', num: '01', label: 'Subir órdenes' },
  { to: '/ordenes', num: '02', label: 'Órdenes' },
  { to: '/cobranza', num: '03', label: 'Cobranza' },
  { to: '/respaldo', num: '04', label: 'Respaldo local' },
  { to: '/configuracion', num: '05', label: 'Configuración' },
];

function initTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('cb-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const { orders } = useOrders();
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(initTheme);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cb-theme', theme);
  }, [theme]);

  useEffect(() => setNavOpen(false), [location.pathname]);

  const overdue = orders.filter((o) => o.creditCycle?.status === 'overdue').length;
  const review = orders.filter((o) => o.creditCycle?.status === 'manual_review').length;

  return (
    <>
      <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />

      <header className="topbar">
        <button className="icon-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Abrir menú">
          ☰
        </button>
        <span className="t-title">Control Bolsas</span>
        <span className="spacer" />
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
        >
          ◐
        </button>
      </header>

      <div className="app-shell">
        <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-mark">CONTROL BOLSAS</div>
            <div className="brand-sub">Master Track · v5.0</div>
          </div>
          <nav className="nav">
            {NAV.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-num">{it.num}</span>
                <span>{it.label}</span>
                {it.to === '/cobranza' && overdue > 0 ? (
                  <span className="nav-badge">{overdue}</span>
                ) : null}
                {it.to === '/ordenes' && review > 0 ? (
                  <span className="nav-badge soft">{review}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              ◐ {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <span className="who">{user?.email}</span>
            <button onClick={() => void signOut()}>⏻ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
