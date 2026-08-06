import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';

export function QuickInvoiceModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const { config } = useConfig();
  
  // Encontrar órdenes que tienen kilos recibidos sin facturar
  const validOrders = useMemo(() => {
    return orders.filter(o => {
      const pendingDeliveries = o.deliveries?.filter(d => !d.invoiced && d.kilos > 0) || [];
      return pendingDeliveries.length > 0;
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
    const pendingDeliveries = selectedOrder.deliveries?.filter(d => !d.invoiced && d.kilos > 0) || [];
    return pendingDeliveries.reduce((acc, d) => acc + d.kilos, 0);
  }, [selectedOrder]);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const order = validOrders.find(o => o.id === oId);
    if (order) {
      const pending = order.deliveries?.filter(d => !d.invoiced && d.kilos > 0) || [];
      setKilosToInvoice(pending.reduce((acc, d) => acc + d.kilos, 0));
    }
  };

  const handleInvoice = async () => {
    if (!selectedOrder) return;
    if (kilosToInvoice <= 0) return toast('Ingresa una cantidad de kilos válida', 'bad');
    if (kilosToInvoice > availableKilos) return toast('No puedes facturar más de lo entregado', 'bad');
    if (!folio.trim()) return toast('Falta el folio de la factura', 'bad');

    setSaving(true);
    try {
      // Create new Invoice
      const newInvoiceId = `inv_${Date.now()}`;
      
      const newInvoice: Invoice = {
        id: newInvoiceId,
        orderId: selectedOrder.id,
        folio: folio.trim(),
        kilos: kilosToInvoice,
        financials: {
          salePricePerKg: config.salePricePerKg,
          costPricePerKg: config.costPricePerKg,
          commissionRate: config.commissionRate,
          saleTotal: kilosToInvoice * config.salePricePerKg,
          invoiceTotal: kilosToInvoice * config.salePricePerKg * (1 + config.ivaRate),
          costTotal: kilosToInvoice * config.costPricePerKg,
          commission: kilosToInvoice * config.salePricePerKg * config.commissionRate,
          netCashFlow: (kilosToInvoice * config.salePricePerKg * (1 + config.ivaRate)) - (kilosToInvoice * config.salePricePerKg * config.commissionRate),
          tradeMargin: (kilosToInvoice * config.salePricePerKg) - (kilosToInvoice * config.costPricePerKg),
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + config.creditDays * 24 * 60 * 60 * 1000),
        }
      };

      // Mark deliveries as invoiced
      let remainingToInvoice = kilosToInvoice;
      const updatedDeliveries = (selectedOrder.deliveries || []).map(d => {
        if (!d.invoiced && d.kilos > 0 && remainingToInvoice > 0) {
          const inv = Math.min(d.kilos, remainingToInvoice);
          remainingToInvoice -= inv;
          return { ...d, invoiced: true, invoiceId: newInvoiceId };
        }
        return d;
      });

      const updatedInvoices = [...(selectedOrder.invoices || []), newInvoice];
      
      const payload = {
        deliveries: updatedDeliveries,
        invoices: updatedInvoices
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
              const pending = o.deliveries?.filter(d => !d.invoiced && d.kilos > 0).reduce((acc, d) => acc + d.kilos, 0) || 0;
              return (
                <option key={o.id} value={o.id}>
                  {o.folio || 'S/N'} - {nombreClienteVisible(o.client)} ({pending.toLocaleString()} kg pendientes)
                </option>
              );
            })}
          </select>
        </label>

        {selectedOrder && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--paper-sunk)', padding: 16, borderRadius: 12, border: '1px solid var(--line)', marginBottom: 20 }}>
            
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
              <span>Total Estimado a Cobrar:</span>
              <strong className="mono">{money(kilosToInvoice * config.salePricePerKg * (1 + config.ivaRate))}</strong>
            </div>

          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleInvoice} disabled={!selectedOrder || saving || !folio.trim()}>
            {saving ? 'Facturando...' : '🧾 Emitir Factura'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
