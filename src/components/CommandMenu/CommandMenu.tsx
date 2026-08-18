import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PurchaseOrder, Product } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PurchaseOrder[];
  products?: Product[];
  onSelectOrder: (orderId: string, tab: string) => void;
  onSelectProduct?: (productId: string) => void;
}

export function CommandMenu({ isOpen, onClose, orders, products = [], onSelectOrder, onSelectProduct }: CommandMenuProps) {
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
        if (isOpen) onClose(); else document.dispatchEvent(new CustomEvent('open-command-menu'));
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const orderResults = query.trim().length >= 2 ? (orders || []).filter(o => {
    if (!o) return false;
    const q = query.toLowerCase();
    if (o.folio?.toLowerCase().includes(q)) return true;
    if (o.client?.toLowerCase().includes(q)) return true;
    if (o.provider?.toLowerCase().includes(q)) return true;
    if (o.collection?.contrareciboNumber?.toLowerCase().includes(q)) return true;
    
    // Check inside invoices and invoice contrarecibos
    if (o.invoices?.some(inv => 
      inv && (
        inv.folio?.toLowerCase().includes(q) || 
        inv.uuid?.toLowerCase().includes(q) ||
        inv.collection?.contrareciboNumber?.toLowerCase().includes(q)
      )
    )) return true;

    return false;
  }).slice(0, 10) : [];

  const productResults = query.trim().length >= 2 ? (products || []).filter(p => {
    if (!p) return false;
    const q = query.toLowerCase();
    if (p.description?.toLowerCase().includes(q)) return true;
    if (p.code?.toLowerCase().includes(q)) return true;
    return false;
  }).slice(0, 5) : [];

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
              {orderResults.length === 0 && productResults.length === 0 ? (
                <div className="no-results">No se encontraron resultados para "{query}"</div>
              ) : (
                <>
                  {orderResults.length > 0 && <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Órdenes</div>}
                  {orderResults.map(o => (
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
                  ))}
                  
                  {productResults.length > 0 && <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginTop: 8 }}>Productos</div>}
                  {productResults.map(p => (
                    <div key={p.id} className="command-item" onClick={() => { onClose(); onSelectProduct?.(p.id); }}>
                      <div className="command-item-main">
                        <span className="folio">📦 {p.code || 'SIN SKU'}</span>
                        <span className="client">{p.description}</span>
                      </div>
                      <div className="command-item-meta">
                        <span className="amount">{money(p.defaultPrice || 0)}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
