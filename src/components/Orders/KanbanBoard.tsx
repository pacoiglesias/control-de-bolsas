import { useState } from 'react';
import { motion } from 'framer-motion';
import { money } from '../../lib/format';
import type { OrderStatus, PurchaseOrder } from '../../lib/types';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';
import { KilosProgressBar } from './KilosProgressBar';
import { sound } from '../../lib/sounds';
import { useToast } from '../../context/ToastContext';
import { db, PATHS } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

type OrderWithSummary = {
  o: PurchaseOrder;
  s: any; // getOrderSummary return type
};

const KANBAN_COLUMNS: { id: OrderStatus; label: string; color: string; bg: string; nextStatus?: OrderStatus; nextLabel?: string }[] = [
  { id: 'pedido', label: 'Pendiente de Facturar', color: 'var(--ink)', bg: 'var(--paper-sunk)', nextStatus: 'facturado', nextLabel: '➔ Facturar' },
  { id: 'facturado', label: 'Facturado', color: 'var(--info)', bg: 'var(--info-bg)', nextStatus: 'pending', nextLabel: '➔ Con CR' },
  { id: 'pending', label: 'Con Contrarecibo', color: 'var(--warn)', bg: 'var(--warn-bg)', nextStatus: 'paid', nextLabel: '➔ Con Contador' },
  { id: 'overdue', label: 'Vencidas', color: 'var(--bad)', bg: 'var(--bad-bg)', nextStatus: 'paid', nextLabel: '➔ Con Contador' },
  { id: 'manual_review', label: 'Revisión Manual', color: 'var(--kanban-review)', bg: 'var(--kanban-review-bg)', nextStatus: 'pending', nextLabel: '➔ Reactivar' },
  { id: 'paid', label: 'Con el Contador', color: 'var(--ok)', bg: 'var(--ok-bg)', nextStatus: 'collected', nextLabel: '➔ En Caja' },
  { id: 'collected', label: '✅ Cobrado y Recolectado', color: 'var(--kanban-collected)', bg: 'var(--kanban-collected-bg)' },
];

export default function KanbanBoard({ items, onSelect }: { items: OrderWithSummary[], onSelect: (o: PurchaseOrder) => void }) {
  const toast = useToast();
  const [activeTarget, setActiveTarget] = useState<OrderStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Group items by status
  const grouped = items.reduce((acc, item) => {
    const tieneKilosSinFacturar = item.s.kilosDelivered > item.s.kilosInvoiced;
    const status: OrderStatus = (tieneKilosSinFacturar && item.o.client !== 'MIGRACION')
      ? 'pedido'
      : item.s.status as OrderStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
  }, {} as Record<OrderStatus, OrderWithSummary[]>);

  const handleMoveStatus = async (order: PurchaseOrder, targetStatus: OrderStatus) => {
    if (!order.id) return;
    setMovingId(order.id);
    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const updatedInvoices = (order.invoices || []).map(inv => ({
        ...inv,
        creditCycle: {
          ...(inv.creditCycle || {}),
          status: targetStatus,
        },
        collection: {
          ...(inv.collection || {}),
          ...(targetStatus === 'paid' ? { paidAt: inv.collection?.paidAt || serverTimestamp() } : {}),
          ...(targetStatus === 'collected' ? { collectedAt: inv.collection?.collectedAt || serverTimestamp() } : {}),
        }
      }));

      await updateDoc(orderRef, {
        'creditCycle.status': targetStatus,
        ...(updatedInvoices.length > 0 ? { invoices: updatedInvoices } : {}),
        updatedAt: serverTimestamp(),
      });

      if (targetStatus === 'paid' || targetStatus === 'collected') {
        sound.playChaChing();
      } else {
        sound.playSwoosh();
      }

      const colInfo = KANBAN_COLUMNS.find(c => c.id === targetStatus);
      toast(`✨ Orden ${order.folio || order.oc || 'actualizada'} movida a "${colInfo?.label || targetStatus}"`, 'ok');
    } catch (err: any) {
      console.error('Error al mover orden:', err);
      toast('No se pudo mover el expediente. Verifica tu conexión.', 'bad');
    } finally {
      setMovingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, orderId: string, currentStatus: OrderStatus) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ orderId, currentStatus }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStatus: OrderStatus) => {
    e.preventDefault();
    setActiveTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.orderId && data.currentStatus !== targetStatus) {
        const found = items.find(it => it.o.id === data.orderId);
        if (found) {
          await handleMoveStatus(found.o, targetStatus);
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <KanbanScrollWrapper>
      {KANBAN_COLUMNS.map(col => {
        const colItems = grouped[col.id] || [];
        const isHovered = activeTarget === col.id;
        
        // Kanban Inteligente: Ordenar por prioridad (Monto * Cercanía)
        if (col.id === 'pending' || col.id === 'overdue') {
          colItems.sort((a, b) => {
            const scoreA = (a.s.invoiceTotal || 0) * (a.s.maxDaysLate || -30);
            const scoreB = (b.s.invoiceTotal || 0) * (b.s.maxDaysLate || -30);
            return scoreB - scoreA;
          });
        }

        return (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDragEnter={() => setActiveTarget(col.id)}
            onDragLeave={() => setActiveTarget(null)}
            onDrop={(e) => handleDrop(e, col.id)}
            style={{
              minWidth: 320,
              width: 320,
              background: isHovered ? 'color-mix(in srgb, var(--ink) 8%, transparent)' : col.bg,
              borderRadius: 20,
              padding: 16,
              border: isHovered
                ? `2px dashed ${col.color}`
                : `1px solid color-mix(in srgb, ${col.color} 20%, transparent)`,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '75vh',
              boxShadow: isHovered
                ? '0 0 15px rgba(217, 119, 6, 0.25)'
                : 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.label}
              </h3>
              <span style={{ background: 'var(--paper-raised)', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: col.color, border: `1px solid color-mix(in srgb, ${col.color} 30%, transparent)` }}>
                {colItems.length}
              </span>
            </div>
            
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, flex: 1 }}>
              {colItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--ink-faint)', fontSize: 12, fontStyle: 'italic', border: '1px dashed var(--line-soft)', borderRadius: 12 }}>
                  {isHovered ? '✨ Suelta aquí para mover' : 'Sin expedientes'}
                </div>
              ) : (
                colItems.map(item => {
                  const isMoving = movingId === item.o.id;

                  return (
                    <motion.div
                      layoutId={`order-${item.o.id}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: isMoving ? 0.5 : 1, scale: 1 }}
                      whileHover={{ y: -4, scale: 1.02, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e as any, item.o.id, col.id)}
                      onClick={() => {
                        sound.playSwoosh();
                        onSelect(item.o);
                      }}
                      key={item.o.id}
                      style={{
                        background: 'var(--glass-bg)', 
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid var(--glass-border)', 
                        borderRadius: 16, 
                        padding: 14,
                        cursor: 'grab',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, opacity: 0.5, cursor: 'grab' }} title="Arrastra para mover">⋮⋮</span>
                          {item.o.oc || item.o.folio || 'Sin Folio'}
                        </div>
                        <div className="num" style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 14 }}>
                          {money(item.s.invoiceTotal)}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        <strong>{item.o.client || 'Sin Cliente'}</strong>
                      </div>

                      {/* Barra Visual de Avance de Kilos */}
                      <KilosProgressBar
                        deliveredKg={item.s.kilosDelivered}
                        totalKg={item.o.totalKilograms || (item.o.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || item.s.kilosDelivered}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hint)', borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2 }}>
                        <div style={{ color: item.s.invoiceTotal - item.s.paidAmount > 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>
                          Saldo Deuda: {money(item.s.invoiceTotal - item.s.paidAmount)}
                        </div>
                      </div>

                      {/* Quick Move Action Buttons */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 4,
                          paddingTop: 6,
                          borderTop: '1px dashed var(--line-soft)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {col.nextStatus && col.nextLabel && (
                          <button
                            type="button"
                            onClick={() => handleMoveStatus(item.o, col.nextStatus!)}
                            disabled={isMoving}
                            style={{
                              flex: 1,
                              background: 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {col.nextLabel}
                          </button>
                        )}
                        <select
                          value={col.id}
                          onChange={(e) => handleMoveStatus(item.o, e.target.value as OrderStatus)}
                          disabled={isMoving}
                          aria-label="Mover a otro estado"
                          style={{
                            background: 'var(--paper-sunk)',
                            color: 'var(--ink)',
                            border: '1px solid var(--line)',
                            borderRadius: 6,
                            padding: '3px 6px',
                            fontSize: 10,
                            cursor: 'pointer',
                            maxWidth: 100,
                          }}
                        >
                          <option value="" disabled>Mover a...</option>
                          {KANBAN_COLUMNS.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </KanbanScrollWrapper>
  );
}
