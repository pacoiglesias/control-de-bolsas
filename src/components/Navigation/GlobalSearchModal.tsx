import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrdersContext } from '../../context/OrdersContext';
import { useProducts } from '../../hooks/useProducts';
import { money } from '../../lib/format';
import { normalizarTexto } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  category: 'Órdenes & OCs' | 'Productos' | 'Comandos Rápidos';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  onSelect: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { orders } = useOrdersContext();
  const { products } = useProducts();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo<SearchResultItem[]>(() => {
    const q = normalizarTexto(query.trim());

    const staticCommands: SearchResultItem[] = [
      {
        id: 'cmd-new-order',
        category: 'Comandos Rápidos',
        title: '➕ Nuevo Expediente / Orden de Compra',
        subtitle: 'Crear una nueva orden de fabricación o venta',
        onSelect: () => {
          navigate('/ordenes?nueva=1');
          onClose();
        },
      },
      {
        id: 'cmd-andres',
        category: 'Comandos Rápidos',
        title: '🏭 Compras & Estado de Cuenta Andrés',
        subtitle: 'Ver saldo de maquilador, abonos y kilos fabricados',
        onSelect: () => {
          navigate('/compras');
          onClose();
        },
      },
      {
        id: 'cmd-caja',
        category: 'Comandos Rápidos',
        title: '💵 Caja Chica & Movimientos',
        subtitle: 'Control de flujo en efectivo, anticipos y egresos',
        onSelect: () => {
          navigate('/caja-chica');
          onClose();
        },
      },
      {
        id: 'cmd-portal',
        category: 'Comandos Rápidos',
        title: '🌐 Portal Maquilador (Andrés)',
        subtitle: 'Abrir portal interactivo de entrega para talleres',
        onSelect: () => {
          window.open('/portal-maquilador', '_blank');
          onClose();
        },
      },
      {
        id: 'cmd-settings',
        category: 'Comandos Rápidos',
        title: '⚙️ Ajustes & Configuración del Sistema',
        subtitle: 'Precios base, departamentos y seguridad',
        onSelect: () => {
          navigate('/ajustes');
          onClose();
        },
      },
    ];

    if (!q) {
      return staticCommands;
    }

    const orderResults: SearchResultItem[] = (orders || [])
      .filter((o: PurchaseOrder) => {
        const folioMatch = normalizarTexto(o.folio || o.oc || '').includes(q);
        const clientMatch = normalizarTexto(o.client || '').includes(q);
        const crMatch = (o.invoices || []).some((inv: any) =>
          normalizarTexto(inv.collection?.contrareciboNumber || '').includes(q)
        );
        const descMatch = normalizarTexto((o as any).productDescription || (o as any).notes || '').includes(q);
        return folioMatch || clientMatch || crMatch || descMatch;
      })
      .slice(0, 8)
      .map((o: PurchaseOrder) => {
        const totalKg = o.totalKilograms || 0;
        const totalAmount = (o.invoices || []).reduce(
          (acc: number, inv: any) => acc + (Number(inv.financials?.invoiceTotal) || Number(inv.financials?.subtotal) || 0),
          0
        );
        const crs = (o.invoices || [])
          .map((inv: any) => inv.collection?.contrareciboNumber)
          .filter(Boolean)
          .join(', ');

        return {
          id: `order-${o.id}`,
          category: 'Órdenes & OCs',
          title: `OC ${o.folio || o.oc || 'S/F'} — ${o.client || 'Sin Cliente'}`,
          subtitle: `${totalKg.toLocaleString('es-MX')} kg • ${money(totalAmount)}${crs ? ` • CR: ${crs}` : ''}`,
          badge: o.provider || 'Andrés',
          badgeColor: '#a78bfa',
          onSelect: () => {
            navigate(`/ordenes?abrir=${o.id}`);
            onClose();
          },
        };
      });

    const productResults: SearchResultItem[] = (products || [])
      .filter((p: any) => {
        const nameMatch = normalizarTexto(p.description || p.name || '').includes(q);
        const codeMatch = normalizarTexto(p.code || '').includes(q);
        return nameMatch || codeMatch;
      })
      .slice(0, 5)
      .map((p: any) => ({
        id: `prod-${p.id}`,
        category: 'Productos',
        title: `📦 ${p.description || p.name || 'Producto'}`,
        subtitle: `Precio base: ${money(p.defaultPrice || 0)}/${p.unit || 'kg'}`,
        badge: p.unit || 'kg',
        badgeColor: '#34d399',
        onSelect: () => {
          navigate('/catalogo');
          onClose();
        },
      }));

    const matchedCommands = staticCommands.filter((cmd) =>
      normalizarTexto(cmd.title).includes(q) || normalizarTexto(cmd.subtitle).includes(q)
    );

    return [...orderResults, ...productResults, ...matchedCommands];
  }, [query, orders, products, navigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <span style={{ fontSize: 20, opacity: 0.7 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por OC, contrarecibo, cliente, producto o comando..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
            }}
          />
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 700,
            }}
          >
            ESC para cerrar
          </span>
        </div>

        {/* Results List */}
        <div
          style={{
            maxHeight: '55vh',
            overflowY: 'auto',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              No se encontraron coincidencias para &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.25) 100%)'
                      : 'transparent',
                    border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? '#93c5fd' : '#fff' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {item.subtitle}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.badge && (
                      <span
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: item.badgeColor || '#fff',
                          border: `1px solid ${item.badgeColor || 'rgba(255,255,255,0.2)'}`,
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          <span>Navega con <b>↑ ↓</b> y selecciona con <b>ENTER</b></span>
          <span>Control Bolsas ERP · v8.9.17</span>
        </div>
      </div>
    </div>
  );
};
