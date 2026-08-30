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
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { GlobalSearchModal } from './Navigation/GlobalSearchModal';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { OfflineBanner } from './OfflineBanner';
import { MobileBottomBar } from './Navigation/MobileBottomBar';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    const handleOpenCommand = () => setSearchOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-menu', handleOpenCommand);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-menu', handleOpenCommand);
    };
  }, []);

  const clientLabel = settings.clientShortName || 'Providencia';
  const providerLabel = settings.providerName || 'Andrés';

  const navItems = useMemo<NavItem[]>(() => [
    { type: 'link', to: '/', icon: '📊', label: 'Centro de Mando / KPIs', end: true, roles: ['admin', 'manager', 'viewer'] },
    
    { type: 'group', label: 'OPERACIÓN & VENTAS', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/ordenes', icon: '📂', label: 'Expedientes de Pedido', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/oc', icon: '🚚', label: 'Seguimiento por OC', roles: ['admin', 'manager'] },
    { type: 'link', to: '/captura-rapida', icon: '📥', label: 'Recepción & Captura Rápida', roles: ['admin', 'manager'] },
    { type: 'link', to: '/catalogo', icon: '🏷️', label: 'Catálogo de Partidas / SKUs', roles: ['admin', 'manager'] },

    { type: 'group', label: 'FINANZAS & TESORERÍA', roles: ['admin', 'manager'] },
    { type: 'link', to: '/cobranza', icon: '🧾', label: `Cuentas por Cobrar (${clientLabel})`, roles: ['admin', 'manager'] },
    { type: 'link', to: '/compras', icon: '🏭', label: `Cuentas por Pagar (${providerLabel})`, roles: ['admin'] },
    { type: 'link', to: '/caja-chica', icon: '💵', label: 'Caja Chica & Tesorería', roles: ['admin'] },

    { type: 'group', label: 'AUDITORÍA & SISTEMA', roles: ['admin'] },
    { type: 'link', to: '/audit', icon: '⚖️', label: 'Balanza & Conciliación', roles: ['admin'] },
    { type: 'link', to: '/mining', icon: '📈', label: 'Inteligencia de Negocio (BI)', roles: ['admin'] },
    { type: 'link', to: '/portal-maquilador', icon: '🚛', label: 'Portal Báscula / Maquila', roles: ['admin', 'manager'] },
    { type: 'link', to: '/centro-control', icon: '⚙️', label: 'Configuración del ERP', roles: ['admin'] },
    { type: 'link', to: '/usuarios', icon: '👥', label: 'Usuarios y Accesos', roles: ['admin'] },
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
    if (isOnline) {
      sound.playSuccess();
    } else {
      sound.playError();
    }
  }, [isOnline]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, marginLeft: 8 }}>
          <OfflineIndicator />
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
                  <div key={it.label} className="nav-group-title">
                    <span>{it.label}</span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={it.to}
                  to={it.to!}
                  end={it.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    sound.playSwoosh();
                    setNavOpen(false);
                  }}
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
            <span className="who">{user?.email}</span>
            <button onClick={() => void signOut()}>⏻ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <OfflineBanner />
          <div className="content">
            <OverdueBanner />
            <DeliveryDueBanner orders={orders} />
            <Outlet />
          </div>
          <footer style={{ padding: '16px 30px 40px', color: 'var(--ink-faint)', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
            Bolsas Elemental v{__APP_VERSION__} · Desarrollado por Paco Iglesias &copy; 2026<br/>
            Última actualización: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Local'}
          </footer>
        </main>
      </div>

      <MobileBottomBar />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
