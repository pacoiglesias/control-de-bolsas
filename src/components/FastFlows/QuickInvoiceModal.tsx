import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { camposInvoices } from '../../lib/invoiceOps';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';
import { computeFinancials, round2 } from '../../lib/finance';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';

export function QuickInvoiceModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const { config } = useConfig();
  const { orders: allOrders } = useOrders();
  
  // Encontrar órdenes que tienen kilos recibidos sin facturar
  const validOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.isClosedShort) return false;
      const kilosEntregados = (o.deliveries || []).reduce((a, d) => a + (d.kilos || 0), 0);
      const kilosFacturados = (o.invoices || []).reduce((a, i) => a + (i.kilos || 0), 0);
      return kilosEntregados > kilosFacturados + 0.01;
    });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [kilosToInvoice, setKilosToInvoice] = useState<number>(0);
  const [folio, setFolio] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedOrder = validOrders.find(o => o.id === selectedOrderId);
  
  // Kilos disponibles sin facturar de la orden seleccionada
  const availableKilos = useMemo(() => {
    if (!selectedOrder) return 0;
    const kilosEntregados = (selectedOrder.deliveries || []).reduce((a, d) => a + (d.kilos || 0), 0);
    const kilosFacturados = (selectedOrder.invoices || []).reduce((a, i) => a + (i.kilos || 0), 0);
    return round2(Math.max(0, kilosEntregados - kilosFacturados));
  }, [selectedOrder]);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const order = validOrders.find(o => o.id === oId);
    if (order) {
      const kilosEntregados = (order.deliveries || []).reduce((a, d) => a + (d.kilos || 0), 0);
      const kilosFacturados = (order.invoices || []).reduce((a, i) => a + (i.kilos || 0), 0);
      setKilosToInvoice(round2(Math.max(0, kilosEntregados - kilosFacturados)));
    }
  };

  const currentSellPrice = selectedOrder?.customSellPrice || config?.salePricePerKg || 43;
  const currentCostPrice = selectedOrder?.customCostPrice || config?.costPricePerKg || 42;

  // Verificación en tiempo real de factura duplicada
  const duplicateInvoice = useMemo(() => {
    if (!folio.trim()) return null;
    return findDuplicateInvoiceFolio(allOrders.length > 0 ? allOrders : orders, folio.trim());
  }, [folio, allOrders, orders]);

  const handleInvoice = async () => {
    if (!selectedOrder) return;
    if (kilosToInvoice <= 0) return toast('Ingresa una cantidad de kilos válida', 'bad');
    if (kilosToInvoice > availableKilos + 0.01) return toast('No puedes facturar más de lo entregado', 'bad');
    if (!folio.trim()) return toast('Falta el folio de la factura', 'bad');

    if (duplicateInvoice) {
      return toast(`⚠️ La factura #${folio.trim()} ya fue registrada en la OC #${duplicateInvoice.orderFolio}. No se permiten facturas duplicadas.`, 'bad');
    }

    setSaving(true);
    try {
      const newInvoiceId = `inv_${Date.now()}`;
      const effectiveConfig = {
        ...config,
        salePricePerKg: currentSellPrice,
        costPricePerKg: currentCostPrice,
      };

      const financials = computeFinancials(kilosToInvoice, effectiveConfig as any);
      
      const newInvoice: Invoice = {
        id: newInvoiceId,
        orderId: selectedOrder.id,
        folio: folio.trim(),
        kilos: kilosToInvoice,
        financials,
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + (config?.creditDays || 30) * 24 * 60 * 60 * 1000),
        }
      };

      // Mark deliveries as invoiced
      let remainingToInvoice = kilosToInvoice;
      const updatedDeliveries = (selectedOrder.deliveries || []).map(d => {
        if (!d.invoiced && (d.kilos || 0) > 0 && remainingToInvoice > 0) {
          const inv = Math.min(d.kilos, remainingToInvoice);
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

      toast('✅ Factura emitida y vinculada correctamente', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al facturar: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🧾 Facturación Rápida" onClose={onClose} wide>
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: 14 }}>
          Selecciona una orden con entregas pendientes por facturar. Esto generará la factura y la pasará directo a Cobranza.
        </p>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>1. Seleccionar Expediente (con Kilos)</span>
          <select 
            value={selectedOrderId} 
            onChange={e => handleSelectOrder(e.target.value)}
            className="input"
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="">-- Selecciona --</option>
            {validOrders.map(o => {
              const kilosEntregados = (o.deliveries || []).reduce((a, d) => a + (d.kilos || 0), 0);
              const kilosFacturados = (o.invoices || []).reduce((a, i) => a + (i.kilos || 0), 0);
              const pending = round2(Math.max(0, kilosEntregados - kilosFacturados));
              return (
                <option key={o.id} value={o.id}>
                  {o.folio || 'S/N'} - {nombreClienteVisible(o.client)} ({pending.toLocaleString()} kg pendientes por facturar)
                </option>
              );
            })}
          </select>
        </label>

        {selectedOrder && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--paper-sunk)', padding: 16, borderRadius: 12, border: '1px solid var(--line)', marginBottom: 20 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Kilos entregados sin factura: <strong style={{ color: 'var(--ink)' }}>{availableKilos.toLocaleString()} kg</strong> (Precio: ${currentSellPrice}/kg)
              </div>
              {kilosToInvoice !== availableKilos && availableKilos > 0 && (
                <button
                  type="button"
                  className="chip active"
                  style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                  onClick={() => setKilosToInvoice(availableKilos)}
                >
                  ⚡ Llenar Todos ({availableKilos.toLocaleString()} kg)
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>2. Folio de Factura (XML)</label>
                <input 
                  type="text" 
                  value={folio} 
                  onChange={e => setFolio(e.target.value.toUpperCase())}
                  className="input" 
                  placeholder="Ej. A-1234"
                  style={{ width: '100%', marginTop: 6 }}
                  autoFocus
                />
                {duplicateInvoice && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                    🚨 Factura #{folio.trim()} ya registrada en la OC #{duplicateInvoice.orderFolio} ({duplicateInvoice.client}).
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>3. Kilos a Facturar</label>
                <input 
                  type="number" 
                  value={kilosToInvoice} 
                  onChange={e => setKilosToInvoice(Number(e.target.value))}
                  className="input" 
                  style={{ width: '100%', marginTop: 6 }}
                  max={availableKilos}
                />
              </div>
            </div>

            <div style={{ background: 'var(--info-bg)', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--info)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Estimado con IVA a Cobrar:</span>
              <strong className="mono">{money(kilosToInvoice * currentSellPrice * (1 + (config?.ivaRate || 0.16)))}</strong>
            </div>

          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button 
            className="btn btn-primary" 
            onClick={handleInvoice} 
            disabled={!selectedOrder || saving || !folio.trim() || !!duplicateInvoice}
            style={{ fontWeight: 800 }}
          >
            {saving ? 'Facturando...' : '🧾 Emitir Factura'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
