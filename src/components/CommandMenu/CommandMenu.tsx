import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PurchaseOrder } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PurchaseOrder[];
  onSelectOrder: (orderId: string, tab: string) => void;
}

export function CommandMenu({ isOpen, onClose, orders, onSelectOrder }: CommandMenuProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
    }
  }, [isOpen]);

  // Handle global Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : document.dispatchEvent(new CustomEvent('open-command-menu'));
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const results = query.trim().length >= 2 ? orders.filter(o => {
    const q = query.toLowerCase();
    if (o.folio?.toLowerCase().includes(q)) return true;
    if (o.client?.toLowerCase().includes(q)) return true;
    if (o.provider?.toLowerCase().includes(q)) return true;
    if (o.collection?.contrareciboNumber?.toLowerCase().includes(q)) return true;
    
    // Check inside invoices
    if (o.invoices?.some(inv => 
      inv.folio?.toLowerCase().includes(q) || 
      inv.uuid?.toLowerCase().includes(q)
    )) return true;

    return false;
  }).slice(0, 15) : [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="command-overlay" onClick={onClose}>
        <motion.div 
          className="command-modal"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="command-header">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por folio, cliente, proveedor, contrarecibo..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <span className="esc-hint">ESC para cerrar</span>
          </div>

          {query.trim().length >= 2 && (
            <div className="command-results">
              {results.length === 0 ? (
                <div className="no-results">No se encontraron resultados para "{query}"</div>
              ) : (
                results.map(o => (
                  <div key={o.id} className="command-item" onClick={() => { onClose(); onSelectOrder(o.id, 'resumen'); }}>
                    <div className="command-item-main">
                      <span className="folio">{o.folio}</span>
                      <span className="client">{nombreClienteVisible(o.client)}</span>
                      <span className="provider badge">{o.provider}</span>
                    </div>
                    <div className="command-item-meta">
                      {o.invoices?.length ? <span className="inv-badge">{o.invoices.length} fact.</span> : null}
                      <span className="amount">{money(o.financials?.saleTotal || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
