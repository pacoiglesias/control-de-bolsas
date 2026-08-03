import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Omnibar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Quick actions parsing
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery === '/caja' || lowerQuery === 'caja') {
      nav('/caja-chica');
    } else if (lowerQuery === '/compras' || lowerQuery === 'compras') {
      nav('/compras');
    } else if (lowerQuery === '/cobranza' || lowerQuery === 'cobranza') {
      nav('/cobranza');
    } else if (lowerQuery === '/ordenes' || lowerQuery === 'ordenes') {
      nav('/ordenes');
    } else if (lowerQuery === '/oc') {
      nav('/oc');
    } else if (lowerQuery === '/mineria' || lowerQuery === '/mining') {
      nav('/mining');
    } else if (lowerQuery === '/catalogo') {
      nav('/catalogo');
    } else {
      // Default behavior: Search orders
      nav(`/ordenes?q=${encodeURIComponent(query)}`);
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 9999, backdropFilter: 'blur(2px)'
            }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            style={{
              position: 'fixed', top: '15%', left: '50%', transform: 'translate(-50%, 0)',
              width: '90%', maxWidth: 600, background: 'var(--bg-card)', 
              borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              zIndex: 10000, overflow: 'hidden', border: '1px solid var(--border)'
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 24, marginRight: 16, opacity: 0.5 }}>🔍</span>
              <input 
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar (folio, cliente) o navegar (ej. /caja)"
                style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 18, color: 'var(--ink)'
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--hint)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-body)' }}>
                ESC para salir
              </div>
            </form>
            <div style={{ padding: '12px 24px', background: 'var(--bg-body)', fontSize: 13, color: 'var(--hint)' }}>
              <strong>Comandos rápidos:</strong> /caja, /compras, /cobranza, /ordenes, /oc, /catalogo
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
