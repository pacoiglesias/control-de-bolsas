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
import { UninvoicedDeliveriesBanner } from './UninvoicedDeliveriesBanner';
import { NotificationsCenter } from './NotificationsCenter';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { GlobalSearchModal } from './Navigation/GlobalSearchModal';
import { KeyboardShortcutsModal } from './Navigation/KeyboardShortcutsModal';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { OfflineBanner } from './OfflineBanner';
import { MobileBottomBar } from './Navigation/MobileBottomBar';
import { AuditCentinelaBadge } from './Audit/AuditCentinelaBadge';

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
  const [density, setDensity] = useState<'normal' | 'compact'>(() => {
    return (localStorage.getItem('cb_table_density') as any) || 'normal';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (density === 'compact') {
      document.body.classList.add('density-compact');
    } else {
      document.body.classList.remove('density-compact');
    }
  }, [density]);

  const toggleDensity = () => {
    const next = density === 'normal' ? 'compact' : 'normal';
    setDensity(next);
    localStorage.setItem('cb_table_density', next);
    toast(next === 'compact' ? '📐 Modo SAP / Alta Densidad activado' : '🔲 Modo Cómodo activado', 'ok');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !isInput) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    const handleOpenCommand = () => setSearchOpen(true);
    const handleOpenShortcuts = () => setShortcutsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-menu', handleOpenCommand);
    window.addEventListener('open-shortcuts-modal', handleOpenShortcuts);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-menu', handleOpenCommand);
      window.removeEventListener('open-shortcuts-modal', handleOpenShortcuts);
    };
  }, []);

  const navItems = useMemo<NavItem[]>(() => [
    { type: 'link', to: '/', icon: '📊', label: 'Dashboard General', end: true, roles: ['admin', 'manager', 'viewer'] },
    
    { type: 'group', label: 'OPERACIÓN & VENTAS', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/ordenes', icon: '📂', label: 'Expedientes (OCs)', roles: ['admin', 'manager', 'viewer'] },
    { type: 'link', to: '/oc', icon: '🚚', label: 'Seguimiento por OC', roles: ['admin', 'manager'] },
    { type: 'link', to: '/captura-rapida', icon: '⚡', label: 'Captura Rápida', roles: ['admin', 'manager'] },
    { type: 'link', to: '/catalogo', icon: '🏷️', label: 'Catálogo de SKUs', roles: ['admin', 'manager'] },

    { type: 'group', label: 'FINANZAS & TESORERÍA', roles: ['admin', 'manager'] },
    { type: 'link', to: '/cobranza', icon: '🧾', label: `Cobranza Providencia`, roles: ['admin', 'manager'] },
    { type: 'link', to: '/compras', icon: '🏭', label: `Compras & Andrés`, roles: ['admin'] },
    { type: 'link', to: '/caja-chica', icon: '💵', label: 'Caja Chica & Efectivo', roles: ['admin'] },

    { type: 'group', label: 'GOBIERNO & AUDITORÍA', roles: ['admin'] },
    { type: 'link', to: '/audit', icon: '⚖️', label: 'Auditoría & Centinela', roles: ['admin'] },
    { type: 'link', to: '/mining', icon: '📈', label: 'Minería & BI', roles: ['admin'] },
    { type: 'link', to: '/portal-maquilador', icon: '🚛', label: 'Portal del Maquilador', roles: ['admin', 'manager'] },
    { type: 'link', to: '/centro-control', icon: '⚙️', label: 'Configuración ERP', roles: ['admin'] },
    { type: 'link', to: '/usuarios', icon: '👥', label: 'Usuarios & Accesos', roles: ['admin'] },
  ], []);

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

  // Badges inteligentes en tiempo real
  const { overdue, review, unbilledOrdersCount } = useMemo(() => {
    let overdue = 0;
    let review = 0;
    let unbilledOrdersCount = 0;
    for (const o of orders) {
      const summary = getOrderSummary(o);
      const st = summary.status;
      if (st === 'overdue') overdue++;
      else if (st === 'manual_review') review++;
      if (summary.kilosDelivered > summary.kilosInvoiced + 0.01 && !o.isClosedShort) {
        unbilledOrdersCount++;
      }
    }
    return { overdue, review, unbilledOrdersCount };
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
          className="topbar-search-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-menu'))}
          title="Buscar cualquier orden, factura o contrarecibo (Ctrl + K)"
        >
          <span>🔍</span>
          <span className="search-label">Buscar...</span>
          <kbd className="search-kbd">Ctrl K</kbd>
        </button>

        <span className="spacer" />
        <AuditCentinelaBadge />
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

          {/* Botón de Densidad de Tablas SAP */}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleDensity}
            aria-label="Alternar Densidad SAP"
            title={density === 'compact' ? "Modo Alta Densidad SAP Activo. Clic para modo cómodo." : "Modo Cómodo Activo. Clic para modo compacto SAP."}
            style={{
              background: density === 'compact' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: density === 'compact' ? '#3b82f6' : 'inherit',
              border: density === 'compact' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
              borderRadius: 8,
              fontSize: 15,
              transition: 'all 0.2s ease',
            }}
          >
            {density === 'compact' ? '📐' : '🔲'}
          </button>
          
          {/* Botón de Atajos de Teclado */}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Ver Atajos de Teclado (?)"
            title="Ver Atajos de Teclado & Teclas Rápidas (Presiona ?)"
            style={{
              borderRadius: 8,
              fontSize: 16,
              transition: 'all 0.2s ease',
            }}
          >
            ⌨️
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
          <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 14px' }}>
            <img src={settings.companyLogoUrl || '/logo.png'} alt="Logo" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div className="brand-mark" style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.3px' }}>{settings.companyName || 'BOLSAS ELEMENTAL'}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                <span className="brand-sub" style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Bolsas Elemental Enterprise</span>
              </div>
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
                  <span className="nav-num" style={{ fontSize: '15px' }}>{it.icon}</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  {it.to === '/cobranza' && overdue > 0 ? (
                    <span className="nav-badge" title={`${overdue} facturas vencidas`}>{overdue}</span>
                  ) : null}
                  {it.to === '/ordenes' && unbilledOrdersCount > 0 ? (
                    <span className="nav-badge soft" title={`${unbilledOrdersCount} órdenes con entregas por facturar`}>{unbilledOrdersCount} fac</span>
                  ) : it.to === '/ordenes' && review > 0 ? (
                    <span className="nav-badge soft">{review}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-foot" style={{ marginTop: 'auto', paddingTop: 14 }}>
            <button
              type="button"
              onClick={handleDownloadLocalBackup}
              title="Descargar copia de seguridad completa a tu dispositivo"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontWeight: 800,
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 11.5,
              }}
            >
              💾 Respaldo Local (1 Clic)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 2px', gap: 6 }}>
              <span className="who" style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {user?.email}
              </span>
              <button
                onClick={() => void signOut()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
                title="Cerrar sesión"
              >
                ⏻ Salir
              </button>
            </div>
          </div>
        </aside>

        <main className="main">
          <OfflineBanner />
          <div className="content">
            <OverdueBanner />
            <DeliveryDueBanner orders={orders} />
            <UninvoicedDeliveriesBanner orders={orders} />
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
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
