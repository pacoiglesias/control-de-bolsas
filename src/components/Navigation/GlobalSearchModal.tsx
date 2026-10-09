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
  category: 'Órdenes & OCs' | 'Facturas' | 'Contrarecibos' | 'Báscula & Entregas' | 'UUID SAT & Fiscal' | 'Pagos & Bancos' | 'Productos' | 'Comandos Rápidos';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  onSelect: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { orders, loading } = useOrdersContext();
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
        id: 'cmd-wizard',
        category: 'Comandos Rápidos',
        title: '🪄 Nuevo Proceso de Compra (Wizard Unificado)',
        subtitle: 'Flujo guiado paso a paso: OC ➔ Báscula ➔ Factura SAT',
        onSelect: () => {
          navigate('/proceso-compra');
          onClose();
        },
      },
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
        id: 'cmd-calculator',
        category: 'Comandos Rápidos',
        title: '🧮 Calculadora Rápida de Kilos $/kg',
        subtitle: 'Simulador flotante de costos con maquila y facturación',
        onSelect: () => {
          window.dispatchEvent(new CustomEvent('open-kilo-calculator'));
          onClose();
        },
      },
      {
        id: 'cmd-balanza',
        category: 'Comandos Rápidos',
        title: '⚖️ Balanza de Comprobación y Cotejo 4-Way',
        subtitle: 'Cotejar cartera de clientes, caja y cuenta con maquila',
        onSelect: () => {
          navigate('/audit');
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
        title: '💵 Efectivo en Caja & Movimientos',
        subtitle: 'Control de flujo de efectivo, abonos a Andrés y retiros',
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
        id: 'cmd-master-excel',
        category: 'Comandos Rápidos',
        title: '📊 Descargar Base de Datos Maestra (.xlsx)',
        subtitle: 'Exportar todas las hojas del ERP a un archivo Excel multi-hoja',
        onSelect: () => {
          navigate('/respaldo');
          onClose();
        },
      },
      {
        id: 'cmd-one-pager',
        category: 'Comandos Rápidos',
        title: '📄 Reporte Ejecutivo One-Pager (PDF)',
        subtitle: 'Descargar resumen directivo oficial en 1 sola página',
        onSelect: () => {
          navigate('/respaldo');
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

    const invoiceResults: SearchResultItem[] = [];
    const crResults: SearchResultItem[] = [];
    const uuidResults: SearchResultItem[] = [];
    const bankResults: SearchResultItem[] = [];
    const deliveryResults: SearchResultItem[] = [];
    const orderResults: SearchResultItem[] = [];

    (orders || []).forEach((o: PurchaseOrder) => {
      const folioNorm = normalizarTexto(o.folio || o.oc || '');
      const clientNorm = normalizarTexto(o.client || '');
      const descNorm = normalizarTexto((o as any).productDescription || (o as any).notes || '');

      // 1. Coincidencia directa de Orden de Compra
      if (folioNorm.includes(q) || clientNorm.includes(q) || descNorm.includes(q)) {
        const totalKg = o.totalKilograms || 0;
        const totalAmount = (o.invoices || []).reduce(
          (acc: number, inv: any) => acc + (Number(inv.financials?.invoiceTotal) || Number(inv.financials?.subtotal) || 0),
          0
        );
        const crs = (o.invoices || [])
          .map((inv: any) => inv.collection?.contrareciboNumber)
          .filter(Boolean)
          .join(', ');

        orderResults.push({
          id: `order-${o.id}`,
          category: 'Órdenes & OCs',
          title: `📁 OC ${o.folio || o.oc || 'S/F'} — ${o.client || 'Sin Cliente'}`,
          subtitle: `${totalKg.toLocaleString('es-MX')} kg • ${money(totalAmount)}${crs ? ` • CR: ${crs}` : ''}`,
          badge: o.provider || 'Andrés',
          badgeColor: '#a78bfa',
          onSelect: () => {
            navigate(`/ordenes?abrir=${o.id}`);
            onClose();
          },
        });
      }

      // 2. Coincidencias en Facturas, UUIDs, Contrarecibos y Pagos
      (o.invoices || []).forEach((inv: any, idx: number) => {
        const invFolioNorm = normalizarTexto(inv.folio || '');
        const invUuidNorm = normalizarTexto(inv.uuid || (inv as any).uuidFiscal || '');
        const invCrNorm = normalizarTexto(inv.collection?.contrareciboNumber || '');
        const invRefNorm = normalizarTexto(
          `${inv.collection?.transferRef || ''} ${inv.collection?.sapDocument || ''} ${inv.collection?.paymentDocument || ''} ${inv.collection?.bankReference || ''}`
        );

        // A) Folio de Factura
        if (invFolioNorm && invFolioNorm.includes(q)) {
          const invKg = Number(inv.kilos || 0);
          const invTot = Number(inv.financials?.invoiceTotal || inv.financials?.subtotal || 0);
          invoiceResults.push({
            id: `inv-${o.id}-${inv.id || idx}`,
            category: 'Facturas',
            title: `🧾 Factura F-${inv.folio} · ${money(invTot)}`,
            subtitle: `${invKg.toLocaleString('es-MX')} kg en OC ${o.folio || o.oc || 'S/F'} (${o.client || 'Cliente'})`,
            badge: inv.creditCycle?.status === 'revision' ? 'En Revisión' : 'Facturada',
            badgeColor: inv.creditCycle?.status === 'revision' ? '#f59e0b' : '#38bdf8',
            onSelect: () => {
              navigate(`/ordenes?abrir=${o.id}&tab=facturas`);
              onClose();
            },
          });
        }

        // B) UUID SAT
        if (invUuidNorm && invUuidNorm.includes(q)) {
          const rawUuid = inv.uuid || (inv as any).uuidFiscal || '';
          uuidResults.push({
            id: `uuid-${o.id}-${inv.id || idx}`,
            category: 'UUID SAT & Fiscal',
            title: `🔐 UUID Fiscal SAT: ${rawUuid.substring(0, 8)}...${rawUuid.substring(rawUuid.length - 6)}`,
            subtitle: `Factura F-${inv.folio || 'S/F'} · OC ${o.folio || o.oc || 'S/F'} (${o.client || 'Cliente'})`,
            badge: 'SAT CFDI',
            badgeColor: '#10b981',
            onSelect: () => {
              navigate(`/ordenes?abrir=${o.id}&tab=facturas`);
              onClose();
            },
          });
        }

        // C) Contrarecibo
        if (invCrNorm && invCrNorm.includes(q)) {
          const crNum = inv.collection?.contrareciboNumber || '';
          crResults.push({
            id: `cr-${o.id}-${inv.id || idx}`,
            category: 'Contrarecibos',
            title: `📑 Contrarecibo CR ${crNum}`,
            subtitle: `Ampara F-${inv.folio || 'S/F'} en OC ${o.folio || o.oc || 'S/F'} (${o.client || 'Cliente'})`,
            badge: 'Providencia CR',
            badgeColor: '#0ea5e9',
            onSelect: () => {
              navigate(`/ordenes?abrir=${o.id}&tab=facturas`);
              onClose();
            },
          });
        }

        // D) Referencia Bancaria / SPEI
        if (invRefNorm && invRefNorm.includes(q)) {
          const ref = inv.collection?.transferRef || inv.collection?.sapDocument || inv.collection?.paymentDocument || 'Ref Bancaria';
          bankResults.push({
            id: `bank-${o.id}-${inv.id || idx}`,
            category: 'Pagos & Bancos',
            title: `🏦 Ref. Bancaria / SPEI: ${ref}`,
            subtitle: `Cobro de Factura F-${inv.folio || 'S/F'} · OC ${o.folio || o.oc || 'S/F'}`,
            badge: 'Pago Conciliado',
            badgeColor: '#22c55e',
            onSelect: () => {
              navigate(`/ordenes?abrir=${o.id}&tab=facturas`);
              onClose();
            },
          });
        }
      });

      // 3. Coincidencias en Báscula y Remisiones
      (o.deliveries || []).forEach((d: any, idx: number) => {
        const dFolioNorm = normalizarTexto(d.docFolio || '');
        const dDriverNorm = normalizarTexto(d.driver || '');
        if ((dFolioNorm && dFolioNorm.includes(q)) || (dDriverNorm && dDriverNorm.includes(q))) {
          const dKg = Number(d.kilos || 0);
          deliveryResults.push({
            id: `del-${o.id}-${d.id || idx}`,
            category: 'Báscula & Entregas',
            title: `⚖️ Remisión / Báscula #${d.docFolio || 'S/F'} · ${dKg.toLocaleString('es-MX')} kg`,
            subtitle: `OC ${o.folio || o.oc || 'S/F'} · ${d.driver ? `Chofer: ${d.driver}` : 'Báscula en patio'}${d.invoiced ? ' (Facturada)' : ' (Pendiente facturar)'}`,
            badge: d.invoiced ? 'Facturada' : 'Por Facturar',
            badgeColor: d.invoiced ? '#38bdf8' : '#f97316',
            onSelect: () => {
              navigate(`/ordenes?abrir=${o.id}&tab=entregas`);
              onClose();
            },
          });
        }
      });
    });

    const productResults: SearchResultItem[] = (products || [])
      .filter((p: any) => {
        const nameMatch = normalizarTexto(p.description || p.name || '').includes(q);
        const codeMatch = normalizarTexto(p.code || '').includes(q);
        return nameMatch || codeMatch;
      })
      .slice(0, 4)
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

    const allMatches = [
      ...invoiceResults,
      ...crResults,
      ...deliveryResults,
      ...uuidResults,
      ...bankResults,
      ...orderResults,
      ...productResults,
      ...matchedCommands,
    ];

    // 🎯 Ordenar por relevancia: coincidencias exactas o de prefijo primero
    const scoredMatches = allMatches.map((item) => {
      const normTitle = normalizarTexto(item.title);
      const normSub = normalizarTexto(item.subtitle);
      let score = 0;

      if (normTitle.startsWith(q) || normTitle.includes(` ${q}`) || normTitle.includes(`-${q}`) || normTitle.includes(`#${q}`)) {
        score += 50;
      }
      if (item.category === 'Facturas' && normTitle.includes(`f-${q}`)) score += 40;
      if (item.category === 'Contrarecibos' && normTitle.includes(`cr ${q}`)) score += 40;
      if (item.category === 'Órdenes & OCs' && normTitle.includes(`oc ${q}`)) score += 40;
      if (normSub.startsWith(q) || normSub.includes(` ${q}`)) score += 10;

      return { item, score };
    });

    scoredMatches.sort((a, b) => b.score - a.score);

    return scoredMatches.slice(0, 16).map((s) => s.item);
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
          {loading ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: '#60a5fa',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid #60a5fa',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Cargando expedientes, facturas y báscula en memoria...</span>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
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
          <span>Control Bolsas ERP · v9.10.24 Enterprise</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 🌐 Host global para abrir la búsqueda rápida desde cualquier módulo o atajo
 */
export const GlobalSearchHost: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '/' || (e.shiftKey && e.key.toLowerCase() === 'f')) && !isInput) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('open-global-search', handleOpen);
    window.addEventListener('open-command-menu', handleOpen);
    window.addEventListener('close-global-search', handleClose);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-global-search', handleOpen);
      window.removeEventListener('open-command-menu', handleOpen);
      window.removeEventListener('close-global-search', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return <GlobalSearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};
