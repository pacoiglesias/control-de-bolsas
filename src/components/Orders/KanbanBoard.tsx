import { motion } from 'framer-motion';
import { kilos, money } from '../../lib/format';
import type { OrderStatus, PurchaseOrder } from '../../lib/types';

type OrderWithSummary = {
  o: PurchaseOrder;
  s: any; // getOrderSummary return type
};

const KANBAN_COLUMNS: { id: OrderStatus; label: string; color: string; bg: string }[] = [
  { id: 'pedido', label: 'Pendiente de Facturar', color: '#0f172a', bg: '#f8fafc' },
  { id: 'facturado', label: 'Facturado', color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'pending', label: 'Con Contrarecibo', color: '#b45309', bg: '#fef3c7' },
  { id: 'overdue', label: 'Vencidas', color: '#b91c1c', bg: '#fef2f2' },
  { id: 'manual_review', label: 'Revisión Manual', color: '#c2410c', bg: '#ffedd5' },
  { id: 'paid', label: 'Con el Contador', color: '#15803d', bg: '#f0fdf4' },
  { id: 'collected', label: '✅ Cobrado y Recolectado', color: '#047857', bg: '#ecfdf5' },
];

export default function KanbanBoard({ items, onSelect }: { items: OrderWithSummary[], onSelect: (o: PurchaseOrder) => void }) {
  // Group items by status
  const grouped = items.reduce((acc, item) => {
    const status = item.s.status as OrderStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
  }, {} as Record<OrderStatus, OrderWithSummary[]>);

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
      {KANBAN_COLUMNS.map(col => {
        const colItems = grouped[col.id] || [];
        
        return (
          <div key={col.id} style={{ minWidth: 320, width: 320, background: col.bg, borderRadius: 12, padding: 12, border: `1px solid ${col.color}20`, display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.label}
              </h3>
              <span style={{ background: '#fff', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: col.color, border: `1px solid ${col.color}30` }}>
                {colItems.length}
              </span>
            </div>
            
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, flex: 1 }}>
              {colItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-faint)', fontSize: 12, fontStyle: 'italic' }}>
                  Sin expedientes
                </div>
              ) : (
                colItems.map(item => (
                  <motion.div
                    key={item.o.id}
                    layoutId={`order-${item.o.id}`}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(item.o)}
                    style={{
                      background: '#fff', borderRadius: 8, padding: 12, 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {item.o.oc || item.o.folio || 'Sin Folio'}
                      </div>
                      <div className="num" style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 14 }}>
                        {money(item.s.invoiceTotal)}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      <strong>{item.o.client || 'Sin Cliente'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hint)', borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2 }}>
                      <div>
                        {kilos(item.s.kilosDelivered)} kg de {kilos(item.o.totalKilograms || 0)} kg
                      </div>
                      <div style={{ color: item.s.invoiceTotal - item.s.paidAmount > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                        Deuda: {money(item.s.invoiceTotal - item.s.paidAmount)}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
