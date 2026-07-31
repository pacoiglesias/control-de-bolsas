import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../hooks/useOrders';
import { getOrderSummary } from '../lib/finance';
import { sound } from '../lib/sounds';

const NAV = [
  { to: '/', icon: '📊', label: 'Panel Principal', end: true, roles: ['admin', 'manager', 'viewer'] },
  { to: '/subir', icon: '📥', label: 'Subir Órdenes', roles: ['admin', 'manager'] },
  // "Expedientes" y "Por Orden de Compra" leen la MISMA coleccion
  // (purchaseOrders): la primera es una fila por expediente, la segunda son
  // los mismos expedientes agrupados por numero de OC con sus facturas
  // desplegadas adentro. Antes se llamaban "Ordenes / Ventas" y "Seguimiento
  // OC", sin relacion visible entre ambas ni pista de cual usar para que.
  { to: '/ordenes', icon: '📋', label: 'Expedientes', roles: ['admin', 'manager', 'viewer'] },
  { to: '/oc', icon: '📦', label: 'Por Orden de Compra', roles: ['admin', 'manager'] },
  { to: '/compras', icon: '🏭', label: 'Compras', roles: ['admin'] },
  { to: '/cobranza', icon: '💰', label: 'Contrarecibos / Cobranza', roles: ['admin', 'manager'] },
  { to: '/catalogo', icon: '🛍️', label: 'Catálogo', roles: ['admin', 'manager'] },
  { to: '/caja-chica', icon: '💵', label: 'CAJA', roles: ['admin'] },
  { to: '/respaldo', icon: '💾', label: 'Respaldo Local', roles: ['admin'] },
  { to: '/usuarios', icon: '👥', label: 'Usuarios', roles: ['admin'] },
  { to: '/logs', icon: '📝', label: 'Bitácora', roles: ['admin'] },
  { to: '/configuracion', icon: '⚙️', label: 'Configuración', roles: ['admin'] },
];

function initTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('cb-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const { user, role, signOut } = useAuth();
  const { orders } = useOrders();
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(initTheme);
  const location = useLocation();
  const nav = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cb-theme', theme);
  }, [theme]);

  useEffect(() => {
    setNavOpen(false);
    const item = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to))));
    document.title = item ? `${item.label} · Control Bolsas` : 'Control Bolsas ERP';
  }, [location.pathname]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sound.playSuccess();
    };
    const handleOffline = () => {
      setIsOnline(false);
      sound.playError();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const term = window.prompt('Buscar expediente, folio o cliente:');
        if (term) nav(`/ordenes?q=${encodeURIComponent(term)}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nav]);

  // Los badges leen el mismo estatus derivado que la tabla de Ordenes. Antes
  // usaban el campo viejo de la raiz y podian quedarse en cero teniendo
  // facturas realmente vencidas.
  const { overdue, review } = useMemo(() => {
    let overdue = 0;
    let review = 0;
    for (const o of orders) {
      const st = getOrderSummary(o).status;
      if (st === 'overdue') overdue++;
      else if (st === 'manual_review') review++;
    }
    return { overdue, review };
  }, [orders]);

  return (
    <>
      <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />

      <header className="topbar">
        <button className="icon-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Abrir menú">
          ☰
        </button>
        <span className="t-title">Control Bolsas</span>
        <span className="spacer" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 13, color: isOnline ? 'var(--ok)' : 'var(--bad)', fontWeight: 500 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isOnline ? 'var(--ok)' : 'var(--bad)' }}></span>
          {isOnline ? 'Sistema OK' : 'Sin conexión'}
        </div>
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
          title="Ctrl+K para Buscar"
        >
          ◐
        </button>
      </header>

      <div className="app-shell">
        <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-mark">CONTROL BOLSAS</div>
            <div className="brand-sub">Master Track · v{__APP_VERSION__} ({typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'})</div>
          </div>
          <nav className="nav">
            {NAV.filter((it) => it.roles.includes(role || 'viewer')).map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-num" style={{ fontSize: '16px' }}>{it.icon}</span>
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
          <footer style={{ padding: '16px 30px 40px', color: 'var(--ink-faint)', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
            Control Bolsas v{__APP_VERSION__} · Desarrollado por Paco Iglesias &copy; 2026<br/>
            Última actualización: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'}
          </footer>
        </main>
      </div>
    </>
  );
}
