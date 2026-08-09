import { useEffect, useState, useRef } from 'react';
import { useOrdersContext } from '../context/OrdersContext';
import { usePurchases } from '../hooks/usePurchases';
import { money } from '../lib/format';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { orders } = useOrdersContext();
  const { purchases } = usePurchases();

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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    const matchedOrders = orders.filter(
      (o) =>
        o.folio?.toLowerCase().includes(q) ||
        o.client?.toLowerCase().includes(q)
    ).map(o => ({ type: 'order', id: o.id, label: `OC ${o.folio}`, desc: o.client, val: o.totalKilograms ? `${o.totalKilograms} kg` : '' }));

    const matchedPurchases = purchases.filter(
      (p) =>
        p.provider?.toLowerCase().includes(q)
    ).map(p => ({ type: 'purchase', id: p.id, label: `Compra ${p.id.substring(0,6)}`, desc: p.provider, val: money(p.totalAmount || 0) }));

    results = [...matchedOrders, ...matchedPurchases].slice(0, 10);
  }

  const navigateTo = (type: string, id: string) => {
    setIsOpen(false);
    if (type === 'order') {
      window.dispatchEvent(new CustomEvent('open-order-modal', { detail: id }));
    } else if (type === 'purchase') {
      window.dispatchEvent(new CustomEvent('open-purchase-modal', { detail: id }));
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
