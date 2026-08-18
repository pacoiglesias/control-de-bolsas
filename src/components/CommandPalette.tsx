import { useEffect, useState, useRef, useMemo } from 'react';
import { useOrdersContext } from '../context/OrdersContext';
import { usePurchases } from '../hooks/usePurchases';
import { usePrivacy } from '../context/PrivacyContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useNavigate } from 'react-router-dom';
import { money } from '../lib/format';
import { extractCr } from '../lib/finance';
import { playSoftClick, playSuccessSound, triggerHaptic } from '../lib/hapticEngine';
import { useToast } from '../context/ToastContext';

interface PaletteItem {
  type: 'order' | 'purchase' | 'route' | 'action';
  id: string;
  label: string;
  desc: string;
  val: string;
  badge?: string;
  badgeColor?: string;
  action?: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { orders } = useOrdersContext();
  const { purchases } = usePurchases();
  const { isPrivate, togglePrivacy } = usePrivacy();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const toast = useToast();

  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';

  const SYSTEM_ACTIONS: PaletteItem[] = useMemo(() => [
    {
      type: 'action',
      id: 'action-privacy',
      label: isPrivate ? '👁️ Desactivar Modo Privacidad' : '🕶️ Activar Modo Privacidad',
      desc: isPrivate ? 'Mostrar cifras y montos en pantalla' : 'Ocultar cifras y montos (Ctrl+H)',
      val: 'Atajo Ctrl+H',
      badge: 'SEGURIDAD',
      badgeColor: '#a855f7',
      action: () => {
        togglePrivacy();
        toast(isPrivate ? '👁️ Cifras visibles' : '🕶️ Modo Privacidad activado (Cifras ocultas)', 'ok');
      },
    },
    {
      type: 'action',
      id: 'action-calculator',
      label: `🧮 Abrir Calculadora de Kilos $/kg`,
      desc: `Simular costos con ${provName} y facturación ${clientName}`,
      val: 'Simulador',
      badge: 'HERRAMIENTA',
      badgeColor: '#3b82f6',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-kilo-calculator'));
        toast('🧮 Calculadora de kilos desplegada', 'info');
      },
    },
    {
      type: 'action',
      id: 'action-balanza',
      label: '⚖️ Balanza de Comprobación y Cotejo',
      desc: `Cotejar cartera de ${clientName}, caja y cuenta con ${provName}`,
      val: 'Auditoría',
      badge: 'CORTE',
      badgeColor: '#10b981',
      action: () => {
        navigate('/audit');
      },
    },
    {
      type: 'action',
      id: 'action-purge',
      label: '🧹 Purga de Expedientes de Prueba',
      desc: 'Conservar los 10 CRs oficiales y archivar registros de desarrollo',
      val: 'Mantenimiento',
      badge: 'DATA',
      badgeColor: '#ef4444',
      action: () => {
        navigate('/centro-control');
      },
    },
  ], [isPrivate, provName, clientName, togglePrivacy, toast, navigate]);

  const ROUTES: PaletteItem[] = [
    { type: 'route', id: '/', label: '📊 Dashboard Principal', desc: 'Panel central de cobranza y operaciones', val: 'Ir' },
    { type: 'route', id: '/ordenes', label: '📂 Expedientes y Órdenes', desc: 'Gestión integral de OCs y entregas', val: 'Ir' },
    { type: 'route', id: '/cobranza', label: '💵 Cobranza y Cuentas por Cobrar', desc: 'Control de contrarecibos y fechas de pago', val: 'Ir' },
    { type: 'route', id: '/caja-chica', label: '💰 Flujo de Efectivo & Caja Chica', desc: 'Entradas, salidas y reparto a socios', val: 'Ir' },
    { type: 'route', id: '/compras', label: `🛒 Compras & Cuenta con ${provName}`, desc: 'Anticipos, entregas en báscula y libro mayor', val: 'Ir' },
    { type: 'route', id: '/oc', label: '📦 Seguimiento por OC', desc: 'Manifiesto logístico y firmas de recepción', val: 'Ir' },
    { type: 'route', id: '/catalogo', label: '🏷️ Catálogo Inteligente', desc: 'Precios, calibres y especificaciones', val: 'Ir' },
    { type: 'route', id: '/captura-rapida', label: '⚡ Captura Rápida', desc: 'Ingreso ágil de órdenes y facturas', val: 'Ir' },
    { type: 'route', id: '/mining', label: '⛏️ Data Mining', desc: 'Minería de datos y métricas avanzadas', val: 'Ir' },
    { type: 'route', id: '/audit', label: '🛡️ Auditoría & Reconciliación', desc: 'Revisión y balances cuadrados', val: 'Ir' },
    { type: 'route', id: '/portal-maquilador', label: `🏭 Portal Maquilador (${provName})`, desc: 'Acceso por PIN para el taller', val: 'Ir' },
    { type: 'route', id: '/centro-control', label: '⚙️ Configuración del Sistema', desc: 'Parámetros universales de la empresa', val: 'Ir' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        triggerHaptic('light');
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const handleCustomOpen = () => {
      setIsOpen(true);
      triggerHaptic('light');
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('open-command-menu', handleCustomOpen);
    window.addEventListener('open-command-menu', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('open-command-menu', handleCustomOpen);
      window.removeEventListener('open-command-menu', handleCustomOpen);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const q = query.toLowerCase().trim();

  const results: PaletteItem[] = useMemo(() => {
    if (!q) {
      return [...SYSTEM_ACTIONS, ...ROUTES.slice(0, 6)];
    }

    const matchedActions = SYSTEM_ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    );

    const matchedOrders: PaletteItem[] = orders
      .filter((o) => {
        if ((o as any).isDeleted) return false;
        const matchFolio = o.folio?.toLowerCase().includes(q);
        const matchOc = (o as any).oc?.toLowerCase().includes(q);
        const matchClient = o.client?.toLowerCase().includes(q);
        const matchDept = o.department?.toLowerCase().includes(q);
        const matchInv = (o.invoices || []).some((inv) => (inv.folio || '').toLowerCase().includes(q));
        const matchCr =
          (o.invoices || []).some((inv) => (extractCr(inv, o) || '').toLowerCase().includes(q)) ||
          (extractCr(undefined, o) || '').toLowerCase().includes(q);
        const matchItems = (o.items || []).some(
          (it) => (it.description || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q)
        );
        return matchFolio || matchOc || matchClient || matchDept || matchInv || matchCr || matchItems;
      })
      .slice(0, 8)
      .map((o) => {
        const cr = (o.invoices || []).map((inv) => extractCr(inv, o)).find(Boolean) || extractCr(undefined, o);
        const facs = (o.invoices || []).map((i) => `#${i.folio}`).filter((f) => f !== '#').join(', ');
        const kilos = o.totalKilograms || (o.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
        return {
          type: 'order',
          id: o.id,
          label: `OC ${o.folio || (o as any).oc || 'S/N'}${cr ? ` · [${cr}]` : ''}`,
          desc: `${o.client || clientName}${facs ? ` · Facturas: ${facs}` : ''}`,
          val: kilos > 0 ? `${kilos.toLocaleString('es-MX')} kg` : 'Expediente',
          badge: cr ? 'CON CR' : 'EXPEDIENTE',
          badgeColor: cr ? '#059669' : '#3b82f6',
        };
      });

    const matchedPurchases: PaletteItem[] = purchases
      .filter((p) => p.provider?.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({
        type: 'purchase',
        id: p.id,
        label: `Compra ${p.id.substring(0, 6)}`,
        desc: p.notes || p.provider || provName,
        val: money(p.totalAmount || 0),
        badge: 'COMPRA',
        badgeColor: '#f59e0b',
      }));

    const matchedRoutes: PaletteItem[] = ROUTES.filter(
      (r) => r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
    );

    return [...matchedActions, ...matchedOrders, ...matchedPurchases, ...matchedRoutes].slice(0, 15);
  }, [q, orders, purchases, SYSTEM_ACTIONS, ROUTES, clientName, provName]);

  // Reset selection index on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const executeItem = (item: PaletteItem) => {
    setIsOpen(false);
    playSuccessSound();
    triggerHaptic('success');

    if (item.type === 'action' && item.action) {
      item.action();
    } else if (item.type === 'route') {
      navigate(item.id);
    } else if (item.type === 'order') {
      navigate('/ordenes');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-order-modal', { detail: item.id }));
      }, 100);
    } else if (item.type === 'purchase') {
      navigate('/compras');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-purchase-modal', { detail: item.id }));
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
      playSoftClick();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      playSoftClick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) executeItem(selected);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="command-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '10vh',
      }}
    >
      <div
        className="command-modal glow-sky"
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--paper, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
      >
        {/* Cabecera del Buscador Spotlight */}
        <div
          className="command-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--line, #334155)',
            background: 'var(--paper-sunk, #0f172a)',
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <input
            ref={inputRef}
            placeholder={`Buscar por OC, CR (TH/GT), cliente, acción rápida o módulo...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ink, #fff)',
              fontSize: 16,
              fontWeight: 500,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.1)',
              padding: '2px 8px',
              borderRadius: 6,
              color: 'var(--ink-soft, #94a3b8)',
            }}
          >
            ESC
          </span>
        </div>

        {/* Resultados con navegación interactiva */}
        <div
          ref={listRef}
          className="command-results"
          style={{
            padding: '8px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-soft, #94a3b8)',
                fontSize: 14,
              }}
            >
              No se encontraron coincidencias para "{query}"
            </div>
          ) : (
            results.map((res, i) => {
              const isSelected = i === selectedIndex;
              return (
                <div
                  key={i}
                  className={`command-item ${isSelected ? 'active' : ''}`}
                  onClick={() => executeItem(res)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#60a5fa' : 'var(--ink, #fff)' }}>
                        {res.label}
                      </span>
                      {res.badge && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: res.badgeColor || '#3b82f6',
                            color: '#fff',
                            textTransform: 'uppercase',
                          }}
                        >
                          {res.badge}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft, #94a3b8)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {res.desc}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-soft, #cbd5e1)' }}>
                      {res.val}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 800 }}>
                        ↵ Enter
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Barra inferior de atajos */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--paper-sunk, #0f172a)',
            borderTop: '1px solid var(--line, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--ink-soft, #94a3b8)',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span><strong style={{ color: 'var(--ink, #fff)' }}>↑ ↓</strong> Navegar</span>
            <span><strong style={{ color: 'var(--ink, #fff)' }}>↵</strong> Ejecutar</span>
            <span><strong style={{ color: 'var(--ink, #fff)' }}>Ctrl+H</strong> Modo Privado</span>
          </div>
          <span><strong>Ctrl+K</strong> Spotlight</span>
        </div>
      </div>
    </div>
  );
}
