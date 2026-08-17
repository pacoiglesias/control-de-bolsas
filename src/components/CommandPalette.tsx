import { useEffect, useState, useRef } from 'react';
import { useOrdersContext } from '../context/OrdersContext';
import { usePurchases } from '../hooks/usePurchases';
import { useNavigate } from 'react-router-dom';
import { money } from '../lib/format';

import { extractCr } from '../lib/finance';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { orders } = useOrdersContext();
  const { purchases } = usePurchases();
  const navigate = useNavigate();

  const ROUTES = [
    { label: 'Ir a Dashboard', path: '/', icon: '📊' },
    { label: 'Ir a Expedientes (Órdenes)', path: '/ordenes', icon: '📂' },
    { label: 'Ir a Cobranza y Cuentas por Cobrar', path: '/cobranza', icon: '💵' },
    { label: 'Ir a Caja Chica', path: '/caja-chica', icon: '💰' },
    { label: 'Ir a Compras y Proveedores', path: '/compras', icon: '🛒' },
    { label: 'Ir a Por OC (Entregas)', path: '/oc', icon: '📦' },
    { label: 'Ir a Catálogo Inteligente', path: '/catalogo', icon: '🏷️' },
    { label: 'Ir a Captura Rápida', path: '/captura-rapida', icon: '⚡' },
    { label: 'Ir a Data Mining', path: '/mining', icon: '⛏️' },
    { label: 'Ir a Auditoría y Reconciliación', path: '/audit', icon: '🛡️' },
    { label: 'Ir a Usuarios y Accesos', path: '/usuarios', icon: '👥' },
    { label: 'Ir a Centro de Control', path: '/centro-control', icon: '⚙️' },
    { label: 'Ir a Portal Maquilador', path: '/portal-maquilador', icon: '🏭' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const handleCustomOpen = () => setIsOpen(true);

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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setIsOpen(false);
  };

  const q = query.toLowerCase().trim();
  let results: any[] = [];

  if (q) {
    const matchedOrders = orders.filter((o) => {
      const matchFolio = o.folio?.toLowerCase().includes(q);
      const matchOc = (o as any).oc?.toLowerCase().includes(q);
      const matchClient = o.client?.toLowerCase().includes(q);
      const matchDept = o.department?.toLowerCase().includes(q);
      const matchInv = (o.invoices || []).some(inv => (inv.folio || '').toLowerCase().includes(q));
      const matchCr = (o.invoices || []).some(inv => (extractCr(inv, o) || '').toLowerCase().includes(q)) || (extractCr(undefined, o) || '').toLowerCase().includes(q);
      const matchItems = (o.items || []).some(it => (it.description || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q));
      return matchFolio || matchOc || matchClient || matchDept || matchInv || matchCr || matchItems;
    }).map(o => {
      const cr = (o.invoices || []).map(inv => extractCr(inv, o)).find(Boolean) || extractCr(undefined, o);
      const facs = (o.invoices || []).map(i => `#${i.folio}`).filter(f => f !== '#').join(', ');
      return {
        type: 'order',
        id: o.id,
        label: `OC ${o.folio || (o as any).oc || 'S/N'}${cr ? ` · CR: ${cr}` : ''}`,
        desc: `${o.client || 'Providencia'}${facs ? ` · Facturas: ${facs}` : ''}`,
        val: o.totalKilograms ? `${o.totalKilograms.toLocaleString('es-MX')} kg` : ''
      };
    });

    const matchedPurchases = purchases.filter(
      (p) =>
        p.provider?.toLowerCase().includes(q)
    ).map(p => ({ type: 'purchase', id: p.id, label: `Compra ${p.id.substring(0,6)}`, desc: p.provider, val: money(p.totalAmount || 0) }));

    const matchedRoutes = ROUTES.filter(r => 
      r.label.toLowerCase().includes(q)
    ).map(r => ({ type: 'route', id: r.path, label: r.label, desc: 'Navegación', val: r.icon }));

    results = [...matchedRoutes, ...matchedOrders, ...matchedPurchases].slice(0, 10);
  } else {
    // Default suggestions when empty
    results = ROUTES.slice(0, 5).map(r => ({ type: 'route', id: r.path, label: r.label, desc: 'Navegación', val: r.icon }));
  }

  const navigateTo = (type: string, id: string) => {
    setIsOpen(false);
    if (type === 'route') {
      navigate(id);
    } else if (type === 'order') {
      navigate('/ordenes');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-order-modal', { detail: id }));
      }, 100);
    } else if (type === 'purchase') {
      navigate('/compras');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-purchase-modal', { detail: id }));
      }, 100);
    }
  };

  return (
    <div className="command-overlay" onClick={handleClose}>
      <div className="command-modal">
        <div className="command-header">
          <span style={{ fontSize: 20, opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            placeholder="Busca expedientes, compras..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="esc-hint">ESC</span>
        </div>
        <div className="command-results">
          {q && results.length === 0 ? (
            <div className="no-results">No se encontraron resultados para "{query}"</div>
          ) : (
            results.map((res, i) => (
              <div key={i} className="command-item" onClick={() => navigateTo(res.type, res.id)}>
                <div className="command-item-main">
                  <span className="folio">{res.label}</span>
                  <span className="client">{res.desc}</span>
                </div>
                <div className="command-item-meta">
                  <span className="amount">{res.val}</span>
                </div>
              </div>
            ))
          )}
          {!q && (
            <div className="no-results" style={{ opacity: 0.5 }}>Escribe para buscar...</div>
          )}
        </div>
      </div>
    </div>
  );
}
