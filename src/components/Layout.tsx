import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../hooks/useOrders';
import { usePurchases } from '../hooks/usePurchases';
import { useExpenses } from '../hooks/useExpenses';
import { useConfig } from '../hooks/useConfig';
import { useToast } from '../context/ToastContext';
import { useProducts } from '../hooks/useProducts';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { usePrivacy } from '../context/PrivacyContext';
import { getOrderSummary } from '../lib/finance';
import { sound } from '../lib/sounds';
import { downloadBackupJsonFile } from '../lib/cloudBackup';
import { CommandMenu } from './CommandMenu/CommandMenu';
import { OnlineUsers } from './OnlineUsers';
import { OverdueBanner } from './OverdueBanner';
import { DeliveryDueBanner } from './DeliveryDueBanner';
import { NotificationsCenter } from './NotificationsCenter';

type NavItem = {
  type?: 'link' | 'group';
  to?: string;
  icon?: string;
  label: string;
  end?: boolean;
  roles: string[];
};

const NAV: NavItem[] = [
  { type: 'link', to: '/', icon: '📊', label: 'Dashboard', end: true, roles: ['admin', 'manager', 'viewer'] },
  
  { type: 'group', label: '-- COMERCIAL --', roles: ['admin', 'manager', 'viewer'] },
  { type: 'link', to: '/ordenes', icon: '📋', label: 'Gestión de Órdenes', roles: ['admin', 'manager', 'viewer'] },
  { type: 'link', to: '/oc', icon: '🚚', label: 'Logística y Entregas', roles: ['admin', 'manager'] },
  { type: 'link', to: '/catalogo', icon: '🛍️', label: 'Catálogo de Productos', roles: ['admin', 'manager'] },

  { type: 'group', label: '-- FINANZAS --', roles: ['admin', 'manager'] },
  { type: 'link', to: '/cobranza', icon: '💰', label: 'Cuentas por Cobrar (CxC)', roles: ['admin', 'manager'] },
  { type: 'link', to: '/captura-rapida', icon: '⚡', label: 'Captura Asistida', roles: ['admin', 'manager'] },
  { type: 'link', to: '/compras', icon: '🏭', label: 'Cuentas por Pagar (CxP)', roles: ['admin'] },
  { type: 'link', to: '/caja-chica', icon: '🏦', label: 'Tesorería y Caja', roles: ['admin'] },

  { type: 'group', label: '-- SISTEMA --', roles: ['admin'] },
  { type: 'link', to: '/audit', icon: '⚖️', label: 'Auditoría & Sábana', roles: ['admin'] },
  { type: 'link', to: '/mining', icon: '📊', label: 'Reportes y Data Mining', roles: ['admin'] },
  { type: 'link', to: '/centro-control', icon: '⚙️', label: 'Ajustes del Sistema', roles: ['admin'] },
  { type: 'link', to: '/usuarios', icon: '👥', label: 'Usuarios y Permisos', roles: ['admin'] },
];

function initTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('cb-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const { user, role, signOut } = useAuth();
  const { orders } = useOrders();
  const { purchases } = usePurchases();
  const { expenses } = useExpenses();
  const { config } = useConfig();
  const toast = useToast();
  const { products } = useProducts();
  const { settings } = useSystemSettings();
  const { isPrivate, togglePrivacy } = usePrivacy();
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(initTheme);
  const location = useLocation();
  const nav = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const handleDownloadLocalBackup = () => {
    try {
      downloadBackupJsonFile(orders, purchases, expenses, config);
      sound.playSuccess();
      toast('💾 Respaldo descargado exitosamente en tu dispositivo.', 'ok');
    } catch (err: any) {
      toast(`Error al exportar respaldo: ${err.message}`, 'bad');
    }
  };

  // Red de seguridad: si algun modal llegara a fallar a mitad de una
  // interaccion sin completar su limpieza (ver el bloqueo de scroll en
  // components/ui.tsx), el body podia quedarse con overflow:hidden para
  // siempre — el scroll dejaba de funcionar en toda la app, no solo en la
  // pantalla donde paso. Esto lo libera solo, cada vez que se cambia de
  // ruta, sin depender de que la limpieza del modal se haya ejecutado bien.
  useEffect(() => {
    document.body.style.overflow = '';
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cb-theme', theme);
  }, [theme]);

  useEffect(() => {
    setNavOpen(false);
    const item = NAV.find((n) => n.to && (n.end ? location.pathname === n.to : location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to))));
    document.title = item ? `${item.label} · Bolsas Elemental` : 'Bolsas Elemental ERP';
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
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleCustomOpen = () => setCommandOpen(true);
    document.addEventListener('open-command-menu', handleCustomOpen);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('open-command-menu', handleCustomOpen);
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
    <div className="layout">
      <div className={`nav-scrim ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} />

      <header className="topbar no-print">
        <button className="icon-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Abrir menú">
          ☰
        </button>
        <span className="t-title">{settings.companyName || 'Bolsas Elemental'}</span>

        {/* Barra de Búsqueda Rápida Universal */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-menu'))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line-soft)',
            borderRadius: 20,
            padding: '5px 12px',
            color: 'var(--ink-soft)',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            marginLeft: 8,
            transition: 'all 0.2s ease',
          }}
          title="Buscar cualquier orden, factura o contrarecibo (Ctrl + K)"
        >
          <span>🔍</span>
          <span style={{ fontSize: 12 }}>Buscar...</span>
          <kbd style={{ fontSize: 10, background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', color: 'var(--ink-soft)' }}>Ctrl K</kbd>
        </button>

        <span className="spacer" />
        <OnlineUsers />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 12 }}>
          <div className="live-status-pill" style={{ background: isOnline ? 'var(--ok-bg)' : 'var(--bad-bg)', color: isOnline ? 'var(--ok)' : 'var(--bad)', borderColor: isOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
            <span className={isOnline ? 'live-pulse-dot' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? 'var(--ok)' : 'var(--bad)' }} />
            <span>{isOnline ? 'En Vivo' : 'Sin Conexión'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Botón de Modo Privado / Discreto */}
          <button
            type="button"
            className="icon-btn"
            onClick={togglePrivacy}
            aria-label={isPrivate ? "Modo Discreto Activo (Clic para mostrar cifras)" : "Modo Visible (Clic para ocultar cifras)"}
            title={isPrivate ? "Modo Discreto Activo: Las cifras sensibles están ocultas en público. Clic para mostrar." : "Modo Visible: Clic para ocultar cifras sensibles en público."}
            style={{
              background: isPrivate ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: isPrivate ? '#f59e0b' : 'inherit',
              border: isPrivate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
              borderRadius: 8,
              fontSize: 16,
              transition: 'all 0.2s ease',
            }}
          >
            {isPrivate ? '🙈' : '👁️'}
          </button>
          
          <NotificationsCenter />
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Cambiar tema"
            title="Cambiar tema Claro / Oscuro"
          >
            ◐
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className={`sidebar no-print ${navOpen ? 'open' : ''}`}>
          <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 16px' }}>
            <img src={settings.companyLogoUrl || '/logo.png'} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
            <div style={{ textAlign: 'center' }}>
              <div className="brand-mark" style={{ fontSize: 16, lineHeight: 1.2 }}>{settings.companyName || 'BOLSAS ELEMENTAL'}</div>
              <div className="brand-sub">ERP · v{__APP_VERSION__} ({typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'})</div>
            </div>
          </div>
          <nav className="nav">
            {NAV.filter((it) => it.roles.includes(role || 'viewer')).map((it) => {
              if (it.type === 'group') {
                return (
                  <div key={it.label} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '20px', marginBottom: '4px', paddingLeft: '16px', letterSpacing: '0.5px' }}>
                    {it.label}
                  </div>
                );
              }
              return (
                <NavLink
                  key={it.to}
                  to={it.to!}
                  end={it.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => sound.playSwoosh()}
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
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <button
              type="button"
              onClick={handleDownloadLocalBackup}
              title="Descargar copia de seguridad completa a tu dispositivo"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              💾 Respaldo Local (1 Clic)
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              ◐ {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <span className="who">{user?.email}</span>
            <button onClick={() => void signOut()}>⏻ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="content">
            <OverdueBanner />
            <DeliveryDueBanner orders={orders} />
            <Outlet />
          </div>
          <footer style={{ padding: '16px 30px 40px', color: 'var(--ink-faint)', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={handleDownloadLocalBackup}
                className="btn btn-small"
                style={{
                  fontSize: 11,
                  padding: '4px 12px',
                  background: 'var(--paper-sunk)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                💾 Descargar Respaldo Local (.JSON)
              </button>
            </div>
            Bolsas Elemental v{__APP_VERSION__} · Desarrollado por Paco Iglesias &copy; 2026<br/>
            Última actualización: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'}
          </footer>
        </main>
      </div>

      <CommandMenu
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        orders={orders}
        products={products}
        onSelectOrder={(orderId, _tab) => {
          setCommandOpen(false);
          nav(`/ordenes?id=${orderId}`);
        }}
        onSelectProduct={() => {
          setCommandOpen(false);
          nav(`/catalogo`);
        }}
      />
    </div>
  );
}
