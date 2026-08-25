import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { camposInvoices } from '../../lib/invoiceOps';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice, PurchaseOrderItem } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';
import { computeFinancials, round2, getOrderSummary } from '../../lib/finance';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';

interface ConceptRow {
  id: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  selected: boolean;
  quantity: number;
  maxAvailable: number;
}

export function QuickInvoiceModal({
  orders,
  initialOrderId,
  onClose,
}: {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { config } = useConfig();
  const { orders: allOrders } = useOrders();
  
  // Encontrar órdenes que tienen kilos recibidos sin facturar
  const validOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.isClosedShort) return false;
      const summary = getOrderSummary(o);
      return summary.kilosDelivered > summary.kilosInvoiced + 0.01;
    });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (initialOrderId && validOrders.some(o => o.id === initialOrderId)) {
      return initialOrderId;
    }
    return validOrders[0]?.id || '';
  });
  const [folio, setFolio] = useState('');
  const [saving, setSaving] = useState(false);
  const [conceptRows, setConceptRows] = useState<ConceptRow[]>([]);

  const selectedOrder = validOrders.find(o => o.id === selectedOrderId);
  
  // Kilos disponibles sin facturar de la orden seleccionada
  const availableKilos = useMemo(() => {
    if (!selectedOrder) return 0;
    const summary = getOrderSummary(selectedOrder);
    return round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
  }, [selectedOrder]);

  const currentSellPrice = selectedOrder?.customSellPrice || config?.salePricePerKg || 43;
  const currentCostPrice = selectedOrder?.customCostPrice || config?.costPricePerKg || 38;

  // Auto-cargar conceptos al montar si hay orden pre-seleccionada
  useState(() => {
    if (selectedOrderId) {
      const order = validOrders.find(o => o.id === selectedOrderId);
      if (order) {
        setTimeout(() => handleSelectOrder(selectedOrderId), 0);
      }
    }
  });

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const order = validOrders.find(o => o.id === oId);
    if (!order) {
      setConceptRows([]);
      return;
    }

    const summary = getOrderSummary(order);
    const pendingKilos = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
    const uninvoicedDeliveries = (order.deliveries || []).filter(d => !d.invoiced);

    if (order.items && order.items.length > 0) {
      const rows: ConceptRow[] = order.items.map((it, idx) => {
        // Calcular kilos entregados no facturados para este item específico
        const deliveredPending = uninvoicedDeliveries.reduce((sum, d) => {
          const di = (d.items || []).find((x: any) => x.itemId === it.id || x.itemId === it.code);
          return sum + (di ? Number(di.quantity || 0) : 0);
        }, 0);

        const maxAvail = deliveredPending > 0 
          ? round2(deliveredPending)
          : (order.items && order.items.length === 1 ? pendingKilos : round2(Math.min(it.quantity || 0, pendingKilos)));

        return {
          id: it.id || `item_${idx}_${Date.now()}`,
          code: it.code || '24111500',
          description: it.description || 'Bolsa de Polietileno',
          unit: it.unit || 'KGM',
          unitPrice: it.unitPrice || currentSellPrice,
          selected: maxAvail > 0 || ((order.items?.length ?? 0) === 1),
          quantity: maxAvail > 0 ? maxAvail : Number(it.quantity || 0),
          maxAvailable: maxAvail > 0 ? maxAvail : Number(it.quantity || 0),
        };
      });
      setConceptRows(rows);
    } else {
      setConceptRows([{
        id: `default_${Date.now()}`,
        code: '24111500',
        description: 'Bolsa de Polietileno (Venta General)',
        unit: 'KGM',
        unitPrice: currentSellPrice,
        selected: true,
        quantity: pendingKilos,
        maxAvailable: pendingKilos,
      }]);
    }
  };

  const toggleRowSelect = (index: number) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const updateRowField = <K extends keyof ConceptRow>(index: number, field: K, val: ConceptRow[K]) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const fillRowMax = (index: number) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].maxAvailable || next[index].quantity, selected: true };
      return next;
    });
  };

  const selectAllRows = (select: boolean) => {
    setConceptRows(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const addNewCustomRow = () => {
    setConceptRows(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        code: '24111500',
        description: 'Concepto adicional...',
        unit: 'KGM',
        unitPrice: currentSellPrice,
        selected: true,
        quantity: 0,
        maxAvailable: availableKilos,
      }
    ]);
  };

  const removeRow = (index: number) => {
    setConceptRows(prev => prev.filter((_, i) => i !== index));
  };

  // Cálculos en tiempo real basados en los conceptos seleccionados
  const selectedRows = useMemo(() => conceptRows.filter(r => r.selected), [conceptRows]);

  const kilosToInvoice = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0));
  }, [selectedRows]);

  const subtotalEstimado = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + ((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice)), 0));
  }, [selectedRows, currentSellPrice]);

  const ivaRate = config?.ivaRate || 0.16;
  const ivaEstimado = round2(subtotalEstimado * ivaRate);
  const totalEstimadoConIva = round2(subtotalEstimado + ivaEstimado);

  const costoEstimado = kilosToInvoice * currentCostPrice;
  const gananciaEstimada = subtotalEstimado - costoEstimado;
  const pctFacturado = availableKilos > 0 ? Math.min(100, Math.round((kilosToInvoice / availableKilos) * 100)) : 0;

  // Verificación en tiempo real de factura duplicada
  const duplicateInvoice = useMemo(() => {
    if (!folio.trim()) return null;
    return findDuplicateInvoiceFolio(allOrders.length > 0 ? allOrders : orders, folio.trim());
  }, [folio, allOrders, orders]);

  const handleInvoice = async () => {
    if (!selectedOrder) return;
    if (selectedRows.length === 0) return toast('Selecciona al menos un concepto para facturar', 'bad');
    if (kilosToInvoice <= 0) return toast('Ingresa una cantidad de kilos válida en los conceptos seleccionados', 'bad');
    if (kilosToInvoice > availableKilos + 0.1) {
      return toast(`⚠️ Los kilos seleccionados (${kilosToInvoice.toLocaleString('es-MX')} kg) superan los entregados pendientes (${availableKilos.toLocaleString('es-MX')} kg)`, 'bad');
    }
    if (!folio.trim()) return toast('Falta el folio de la factura', 'bad');

    if (duplicateInvoice) {
      return toast(`🚨 La factura #${folio.trim()} ya fue registrada en la OC #${duplicateInvoice.orderFolio}. No se permiten facturas duplicadas.`, 'bad');
    }

    setSaving(true);
    try {
      const newInvoiceId = `inv_${Date.now()}`;
      const effectiveConfig = {
        ...config,
        salePricePerKg: currentSellPrice,
        costPricePerKg: currentCostPrice,
      };

      const baseFinancials = computeFinancials(kilosToInvoice, effectiveConfig as any);
      
      const invoiceItems: PurchaseOrderItem[] = selectedRows.map(r => ({
        id: r.id,
        code: r.code || '24111500',
        description: r.description.trim(),
        quantity: Number(r.quantity) || 0,
        unit: r.unit || 'KGM',
        unitPrice: Number(r.unitPrice) || currentSellPrice,
        amount: round2((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice)),
      }));

      const conceptNotes = invoiceItems.map(it => `${it.description} (${it.quantity.toLocaleString('es-MX')} kg)`).join(' · ');

      const newInvoice: Invoice = {
        id: newInvoiceId,
        orderId: selectedOrder.id,
        folio: folio.trim(),
        kilos: kilosToInvoice,
        items: invoiceItems,
        financials: {
          ...baseFinancials,
          saleTotal: subtotalEstimado,
          invoiceTotal: totalEstimadoConIva,
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + (config?.creditDays || 30) * 24 * 60 * 60 * 1000),
        },
        collection: {
          paidAmount: 0,
          contrareciboNumber: '',
          notes: conceptNotes ? `Conceptos: ${conceptNotes}` : '',
        }
      };

      // Mark deliveries as invoiced
      let remainingToInvoice = kilosToInvoice;
      const updatedDeliveries = (selectedOrder.deliveries || []).map(d => {
        const dKilos = (d.items && d.items.length > 0)
          ? d.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0)
          : Number(d.kilos || 0);

        if (!d.invoiced && dKilos > 0 && remainingToInvoice > 0) {
          const inv = Math.min(dKilos, remainingToInvoice);
          remainingToInvoice -= inv;
          return { ...d, invoiced: true, invoiceId: newInvoiceId };
        }
        return d;
      });

      const updatedInvoices = [...(selectedOrder.invoices || []), newInvoice];
      
      const payload = {
        deliveries: updatedDeliveries,
        ...camposInvoices(updatedInvoices)
      };

      await updateDoc(doc(db, PATHS.orders, selectedOrder.id), payload);

      toast('✅ Factura emitida con conceptos desglosados y vinculada exitosamente', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al facturar: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🧾 Facturación Rápida Multi-Concepto" onClose={onClose} wide>
      <div style={{ padding: '4px 0' }}>
        
        {/* ENCABEZADO EXPLICATIVO */}
        <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(59,130,246,0.12) 100%)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px', borderRadius: 12, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            <strong>Facturación Inteligente por Partidas:</strong> Marca las casillas de los conceptos entregados, ajusta sus kilos y genera la factura con desglose fiscal SAT automático.
          </div>
        </div>

        {/* 1. SELECCIÓN DE EXPEDIENTE */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
            1. Seleccionar Expediente / OC con Entregas Recibidas
          </label>
          <select 
            value={selectedOrderId} 
            onChange={e => handleSelectOrder(e.target.value)}
            className="input boxed"
            style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px 14px', borderRadius: 10 }}
          >
            <option value="">-- Selecciona un expediente con entregas por facturar --</option>
            {validOrders.map(o => {
              const summary = getOrderSummary(o);
              const pending = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
              return (
                <option key={o.id} value={o.id}>
                  {o.folio || o.oc || 'S/N'} · {nombreClienteVisible(o.client)} — ({pending.toLocaleString('es-MX')} kg listos para facturar)
                </option>
              );
            })}
          </select>
          {validOrders.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
              ℹ️ No hay órdenes con entregas pendientes de facturar en este momento.
            </div>
          )}
        </div>

        {selectedOrder && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* ─── BARRA DE PROGRESO DE KILOS FACTURADOS ─────────── */}
            <div style={{ background: 'var(--paper-sunk)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  Kilos entregados sin factura: <strong className="mono" style={{ fontSize: 14, color: 'var(--ink)' }}>{availableKilos.toLocaleString('es-MX')} kg</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: pctFacturado === 100 ? '#059669' : '#2563eb', fontSize: 11 }}>
                    {pctFacturado}% amparado ({kilosToInvoice.toLocaleString('es-MX')} kg)
                  </span>
                </div>
              </div>
              <div style={{ width: '100%', height: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${pctFacturado}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  style={{ height: '100%', background: pctFacturado === 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: 999 }}
                />
              </div>
            </div>

            {/* ─── SELECTOR INTERACTIVO DE CONCEPTOS Y PARTIDAS ─────────── */}
            <div style={{ background: 'var(--paper-raised)', padding: 16, borderRadius: 14, border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📦</span> 2. Conceptos a Incluir ({selectedRows.length} de {conceptRows.length} seleccionados)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Marca qué partidas ampara esta factura y define los kilos individuales.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11.5, padding: '4px 10px', background: 'var(--paper)', border: '1px solid var(--line)' }}
                    onClick={() => selectAllRows(true)}
                  >
                    ⚡ Seleccionar Todos
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11.5, padding: '4px 10px', background: 'var(--paper)', border: '1px solid var(--line)' }}
                    onClick={() => selectAllRows(false)}
                  >
                    Deseleccionar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 11.5, padding: '4px 12px' }}
                    onClick={addNewCustomRow}
                  >
                    ➕ Agregar Concepto
                  </button>
                </div>
              </div>

              {conceptRows.length > 0 ? (
                <div className="table-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 12, width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>✓</th>
                        <th style={{ width: 115 }}>Clave SAT</th>
                        <th>Descripción del Concepto</th>
                        <th className="num" style={{ width: 145 }}>Kilos Facturar</th>
                        <th className="num" style={{ width: 100 }}>P. Unitario</th>
                        <th className="num" style={{ width: 115 }}>Importe</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {conceptRows.map((row, idx) => {
                          const rowAmount = round2((Number(row.quantity) || 0) * (Number(row.unitPrice) || currentSellPrice));
                          return (
                            <motion.tr 
                              key={row.id || idx}
                              layout
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              style={{ 
                                background: row.selected ? 'rgba(37,99,235,0.06)' : 'transparent',
                                borderLeft: row.selected ? '3px solid #2563eb' : '3px solid transparent',
                                opacity: row.selected ? 1 : 0.6,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={row.selected} 
                                  onChange={() => toggleRowSelect(idx)}
                                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  className="input boxed mono"
                                  value={row.code}
                                  onChange={e => updateRowField(idx, 'code', e.target.value)}
                                  placeholder="24111500"
                                  style={{ fontSize: 11.5, padding: '4px 6px', fontWeight: 600, color: '#1e40af' }}
                                  disabled={!row.selected}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  className="input boxed"
                                  value={row.description}
                                  onChange={e => updateRowField(idx, 'description', e.target.value)}
                                  placeholder="Descripción del producto..."
                                  style={{ fontSize: 12, padding: '4px 8px', fontWeight: row.selected ? 700 : 400 }}
                                  disabled={!row.selected}
                                />
                              </td>
                              <td className="num">
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    className="input boxed mono"
                                    value={row.quantity || ''}
                                    onChange={e => updateRowField(idx, 'quantity', Number(e.target.value))}
                                    style={{ width: 85, textAlign: 'right', fontWeight: 800, padding: '4px 6px' }}
                                    disabled={!row.selected}
                                  />
                                  {row.maxAvailable > 0 && row.quantity !== row.maxAvailable && (
                                    <button
                                      type="button"
                                      onClick={() => fillRowMax(idx)}
                                      className="chip"
                                      style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(37,99,235,0.12)', color: '#1d4ed8', border: 'none', cursor: 'pointer', fontWeight: 800 }}
                                      title="Llenar máximo disponible"
                                    >
                                      Máx
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="num">
                                <input 
                                  type="number"
                                  step="0.01"
                                  className="input boxed mono"
                                  value={row.unitPrice || ''}
                                  onChange={e => updateRowField(idx, 'unitPrice', Number(e.target.value))}
                                  style={{ width: 75, textAlign: 'right', padding: '4px 6px' }}
                                  disabled={!row.selected}
                                />
                              </td>
                              <td className="num mono" style={{ fontWeight: 900, color: row.selected ? '#047857' : 'inherit' }}>
                                {money(rowAmount)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeRow(idx)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 14, opacity: 0.7 }}
                                  title="Eliminar fila"
                                >
                                  ✕
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ background: 'var(--paper-sunk)', padding: 16, borderRadius: 10, textAlign: 'center', color: 'var(--ink-soft)' }}>
                  No hay conceptos cargados. Usa "+ Agregar Concepto" para crear uno.
                </div>
              )}
            </div>

            {/* ─── DATOS FISCALES & RECIBO DIGITAL ────────────────────────────────────── */}
            <div style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.03) 0%, rgba(30,41,59,0.06) 100%)', border: '1px solid var(--line)', padding: 18, borderRadius: 14 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* Folio */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                    3. Folio Fiscal de la Factura (SAT / CFDI)
                  </label>
                  <input 
                    type="text" 
                    value={folio} 
                    onChange={e => setFolio(e.target.value.toUpperCase())}
                    className="input boxed mono" 
                    placeholder="Ej. A-1234"
                    style={{ width: '100%', fontWeight: 900, fontSize: 15, padding: '10px 14px', letterSpacing: '0.05em' }}
                    autoFocus
                  />
                  {duplicateInvoice && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: '#dc2626', fontWeight: 800, background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                      🚨 Factura #{folio.trim()} ya registrada en la OC #{duplicateInvoice.orderFolio} ({duplicateInvoice.client}).
                    </div>
                  )}
                </div>
                
                {/* Resumen Kilos */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                    Total Kilos a Amparar
                  </label>
                  <div style={{ padding: '9px 14px', background: 'var(--paper-raised)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono" style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)' }}>
                      {kilosToInvoice.toLocaleString('es-MX')} kg
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      de {availableKilos.toLocaleString('es-MX')} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Tarjeta de Totales Fiscales */}
              <div style={{ background: 'var(--paper-raised)', padding: 16, borderRadius: 12, border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Subtotal (sin IVA):</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginTop: 2 }}>{money(subtotalEstimado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>IVA ({Math.round(ivaRate * 100)}%):</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: '#2563eb', marginTop: 2 }}>+{money(ivaEstimado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 800 }}>Total con IVA a Cobrar:</div>
                  <div className="mono" style={{ fontWeight: 900, fontSize: 19, color: '#047857', marginTop: 2 }}>{money(totalEstimadoConIva)}</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--line-soft)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Margen Bruto Est.:</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: gananciaEstimada >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>
                    {money(gananciaEstimada)}
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving} style={{ minHeight: 44, padding: '0 18px' }}>Cancelar</button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary" 
            onClick={handleInvoice} 
            disabled={!selectedOrder || saving || !folio.trim() || !!duplicateInvoice || kilosToInvoice <= 0 || selectedRows.length === 0}
            style={{ 
              fontWeight: 900, 
              padding: '12px 24px', 
              fontSize: 14,
              minHeight: 46,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
              border: 'none',
            }}
          >
            {saving ? 'Facturando…' : `🧾 Emitir Factura (#${folio || '…'}) · ${money(totalEstimadoConIva)}`}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
