import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../hooks/useOrders';
import { usePurchases } from '../hooks/usePurchases';
import { useExpenses } from '../hooks/useExpenses';
import { useConfig } from '../hooks/useConfig';
import { useToast } from '../context/ToastContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { usePrivacy } from '../context/PrivacyContext';
import { getOrderSummary } from '../lib/finance';
import { sound } from '../lib/sounds';
import { downloadBackupJsonFile } from '../lib/cloudBackup';
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
  const { settings } = useSystemSettings();
  const { isPrivate, togglePrivacy } = usePrivacy();
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(initTheme);
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const clientLabel = settings.clientShortName || 'Providencia';
  const providerLabel = settings.providerName || 'Andrés';

  const navItems = useMemo<NavItem[]>(() => [
    { type: 'link', to: '/', icon: '📊', label: 'Dashboard Maestro', end: true, roles: ['admin', 'manager', 'viewer'] },
    
    { type: 'group', label: 'OPERACIÓN & VENTAS', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/ordenes', icon: '📂', label: 'Expedientes y OCs', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/oc', icon: '🚚', label: 'Entregas en Báscula', roles: ['admin', 'manager'] },
    { type: 'link', to: '/captura-rapida', icon: '⚡', label: 'Captura Rápida (OCR)', roles: ['admin', 'manager'] },
    { type: 'link', to: '/catalogo', icon: '🛍️', label: 'Catálogo de Bolsas', roles: ['admin', 'manager'] },

    { type: 'group', label: 'FINANZAS & CAJA', roles: ['admin', 'manager'] },
    { type: 'link', to: '/cobranza', icon: '💵', label: `Cobranza ${clientLabel}`, roles: ['admin', 'manager'] },
    { type: 'link', to: '/compras', icon: '🛒', label: `Compras ${providerLabel}`, roles: ['admin'] },
    { type: 'link', to: '/caja-chica', icon: '💵', label: 'Efectivo en Caja', roles: ['admin'] },

    { type: 'group', label: 'CONTROL & AUDITORÍA', roles: ['admin'] },
    { type: 'link', to: '/audit', icon: '⚖️', label: 'Auditoría & Sábana', roles: ['admin'] },
    { type: 'link', to: '/mining', icon: '📈', label: 'Métricas & Data Mining', roles: ['admin'] },
    { type: 'link', to: '/portal-maquilador', icon: '⚖️', label: 'Portal Proveedor / Báscula', roles: ['admin', 'manager'] },
    { type: 'link', to: '/centro-control', icon: '⚙️', label: 'Centro de Control', roles: ['admin'] },
    { type: 'link', to: '/usuarios', icon: '👥', label: 'Usuarios y Permisos', roles: ['admin'] },
  ], [clientLabel, providerLabel]);

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
    const item = navItems.find((n) => n.to && (n.end ? location.pathname === n.to : location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to))));
    document.title = item ? `${item.label} · Bolsas Elemental` : 'Bolsas Elemental ERP';
  }, [location.pathname, navItems]);

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

    // El atajo Ctrl+K y el evento 'open-command-menu' los maneja únicamente
    // <CommandPalette/> (montado una sola vez en AppProviders). Antes Layout
    // tenía su propio listener de Ctrl+K y su propio <CommandMenu/>, así que
    // una sola pulsación abría dos buscadores superpuestos a la vez. El
    // botón "Buscar..." de arriba sigue funcionando igual: solo dispara el
    // evento, que CommandPalette escucha globalmente.
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
            {navItems.filter((it) => it.roles.includes(role || 'viewer')).map((it) => {
              if (it.type === 'group') {
                return (
                  <div key={it.label} style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ink-soft)', opacity: 0.75, marginTop: '18px', marginBottom: '4px', paddingLeft: '12px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
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
            {/* El cambio de tema ya vive en el ícono ◐ de la barra superior
                (siempre visible); este botón duplicaba la misma acción. */}
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
            {/* El botón de respaldo local ya vive en el pie del sidebar
                ("💾 Respaldo Local (1 Clic)"); aquí se repetía la misma
                acción con otra etiqueta. */}
            Bolsas Elemental v{__APP_VERSION__} · Desarrollado por Paco Iglesias &copy; 2026<br/>
            Última actualización: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'}
          </footer>
        </main>
      </div>
    </div>
  );
}
