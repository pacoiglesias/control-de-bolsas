import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, Timestamp, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui';
import type { PurchaseOrder, Delivery } from '../../lib/types';
import { nombreClienteVisible } from '../../lib/format';
import { round2, getOrderSummary } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';

interface QuickDeliveryModalProps {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onClose: () => void;
}

export function QuickDeliveryModal({ orders, initialOrderId, onClose }: QuickDeliveryModalProps) {
  const toast = useToast();

  // Filtrar órdenes que tienen kilos pendientes por entregar físicamente
  const pendingOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!o || o.isClosedShort) return false;
        const summary = getOrderSummary(o);
        const total = Number(o.totalKilograms) || 0;
        return summary.kilosDelivered < total - 0.01;
      })
      .map((o) => {
        const summary = getOrderSummary(o);
        const total = Number(o.totalKilograms) || 0;
        const entregados = summary.kilosDelivered;
        const faltante = round2(Math.max(0, total - entregados));
        return {
          order: o,
          total,
          entregados,
          faltante,
        };
      })
      .sort((a, b) => b.faltante - a.faltante);
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId && pendingOrders.some((p) => p.order.id === initialOrderId)
      ? initialOrderId
      : pendingOrders[0]?.order.id || ''
  );

  const selectedInfo = pendingOrders.find((p) => p.order.id === selectedOrderId);

  const [kilos, setKilos] = useState<number | ''>(selectedInfo ? selectedInfo.faltante : '');
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [driver, setDriver] = useState<string>('Andrés');
  const [saving, setSaving] = useState(false);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const info = pendingOrders.find((p) => p.order.id === oId);
    if (info) {
      setKilos(info.faltante);
    }
  };

  const willExceed = selectedInfo && typeof kilos === 'number' && kilos > selectedInfo.faltante;

  const handleSaveDelivery = async () => {
    if (!selectedInfo) {
      toast('Selecciona una orden de compra válida.', 'bad');
      return;
    }
    const k = Number(kilos);
    if (!k || k <= 0) {
      toast('Ingresa una cantidad de kilos válida mayor a 0.', 'bad');
      return;
    }

    if (k > selectedInfo.faltante) {
      toast(
        `⛔ Regla Inviolable: No puedes entregar más de ${selectedInfo.faltante.toLocaleString('es-MX')} kg faltantes. Andrés nunca entrega de más.`,
        'bad'
      );
      return;
    }

    setSaving(true);
    triggerHaptic();

    try {
      const orderRef = doc(db, PATHS.orders, selectedInfo.order.id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) {
          throw new Error('La orden no existe en la base de datos.');
        }

        const data = snap.data();
        const existingDeliveries: Delivery[] = data.deliveries ?? [];

        const [yyyy, mm, dd] = dateStr.split('-');
        const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);

        const newDelivery: Delivery = {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          date: Timestamp.fromDate(dateObj),
          kilos: k,
          driver: driver.trim() || 'Andrés',
          invoiced: false,
          notes: `Entrega directa de ${k.toLocaleString('es-MX')} kg - Almacén Providencia`,
        };

        existingDeliveries.push(newDelivery);
        tx.update(orderRef, {
          deliveries: existingDeliveries,
          updatedAt: Timestamp.now(),
        });
      });

      toast(`✅ Entrega de ${k.toLocaleString('es-MX')} kg registrada exitosamente.`, 'ok');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast(`Error al guardar entrega: ${err.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="📦 Registrar Entrega de Andrés"
      onClose={onClose}
      wide={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pendingOrders.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🎉</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              Todas las OCs activas ya fueron entregadas al 100%
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: 13 }}>
              No hay entregas pendientes de registrar por parte de Andrés.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Selector de Orden de Compra */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 6 }}>
                Selecciona la Orden de Compra (OC):
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {pendingOrders.map((p) => {
                  const isSel = p.order.id === selectedOrderId;
                  const pct = Math.min(100, Math.round((p.entregados / p.total) * 100));
                  return (
                    <motion.div
                      key={p.order.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectOrder(p.order.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: isSel ? '2px solid #2563eb' : '1px solid var(--line)',
                        background: isSel ? 'rgba(37,99,235,0.08)' : 'var(--paper-sunk)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: isSel ? '#2563eb' : 'var(--ink)' }}>
                          {p.order.oc || p.order.folio}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {nombreClienteVisible(p.order.client)} · Pedidos: {p.total.toLocaleString('es-MX')} kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#b45309',
                            background: '#fef3c7',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontFamily: 'monospace',
                          }}
                        >
                          Faltan {p.faltante.toLocaleString('es-MX')} kg
                        </span>
                        <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 3 }}>
                          {pct}% entregado
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {selectedInfo && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedInfo.order.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  {/* Tarjeta de Resumen de la OC seleccionada */}
                  <div
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>PEDIDO TOTAL</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink)' }}>
                        {selectedInfo.total.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>YA ENTREGADO</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                        {selectedInfo.entregados.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>FALTANTE MÁXIMO</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: '#f59e0b' }}>
                        {selectedInfo.faltante.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                  </div>

                  {/* 2. Campo de Kilos de Entrega */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 6 }}>
                      Kilos a Entregar en esta Remisión:
                    </label>
                    <div
                      style={{
                        background: 'var(--paper-sunk)',
                        border: willExceed ? '2px solid var(--bad)' : '2px solid var(--accent)',
                        borderRadius: 12,
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={selectedInfo.faltante}
                        value={kilos}
                        onChange={(e) => setKilos(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: 22,
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          color: willExceed ? 'var(--bad)' : 'var(--ink)',
                        }}
                        autoFocus
                      />
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>kg</span>
                    </div>

                    {/* Atajos de llenado rápido */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setKilos(selectedInfo.faltante)}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #10b981',
                          background: 'rgba(16,185,129,0.1)',
                          color: '#047857',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        ⚡ Entregar Todo el Faltante ({selectedInfo.faltante.toLocaleString('es-MX')} kg)
                      </button>
                      {selectedInfo.faltante > 1000 && (
                        <button
                          type="button"
                          onClick={() => setKilos(round2(selectedInfo.faltante / 2))}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          50% ({round2(selectedInfo.faltante / 2).toLocaleString('es-MX')} kg)
                        </button>
                      )}
                    </div>

                    {willExceed && (
                      <div style={{ color: 'var(--bad)', fontSize: 11.5, fontWeight: 800, marginTop: 6 }}>
                        ⚠️ ¡Error! No se pueden entregar más de {selectedInfo.faltante.toLocaleString('es-MX')} kg. La OC no permite excedentes.
                      </div>
                    )}
                  </div>

                  {/* 3. Fecha y Chofer */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Fecha de Entrega:
                      </label>
                      <input
                        type="date"
                        className="input boxed"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontWeight: 700 }}
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Transporte / Chofer:
                      </label>
                      <input
                        type="text"
                        className="input boxed"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }}
                        value={driver}
                        onChange={(e) => setDriver(e.target.value)}
                        placeholder="Andrés"
                      />
                    </div>
                  </div>

                  {/* 4. Botones de Acción */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <button type="button" className="btn" onClick={onClose} disabled={saving}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveDelivery}
                      disabled={saving || !selectedInfo || !kilos || Number(kilos) <= 0 || willExceed}
                      style={{
                        background: willExceed ? 'var(--bad)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontWeight: 800,
                        padding: '10px 20px',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 10,
                        cursor: willExceed || saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {saving ? 'Guardando...' : `✅ Guardar Entrega (${kilos || 0} kg)`}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
