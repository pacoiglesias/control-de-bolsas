import { motion } from 'framer-motion';
import { kilos, money } from '../../lib/format';
import type { OrderStatus, PurchaseOrder } from '../../lib/types';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';
import { sound } from '../../lib/sounds';

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
    // "Pendiente de Facturar" en la lista (Iteracion 68) significa
    // "hay kilos entregados sin facturar", sin importar si ya existe una
    // factura parcial -- distinto al status puro. Antes este tablero
    // agrupaba solo por status, asi que un expediente con una factura
    // parcial ya capturada (status='pending') aparecia aqui como
    // "Con Contrarecibo" en vez de "Pendiente de Facturar", aunque la
    // lista SI lo mostrara ahi -- mismos datos, dos lugares distintos
    // del sistema en desacuerdo. Ahora usan el mismo criterio.
    const tieneKilosSinFacturar = item.s.kilosDelivered > item.s.kilosInvoiced;
    const status: OrderStatus = (tieneKilosSinFacturar && item.o.client !== 'MIGRACION')
      ? 'pedido'
      : item.s.status as OrderStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
  }, {} as Record<OrderStatus, OrderWithSummary[]>);

  return (
    <KanbanScrollWrapper>
      {KANBAN_COLUMNS.map(col => {
        const colItems = grouped[col.id] || [];
        
        // Kanban Inteligente: Ordenar por prioridad (Monto * Cercanía)
        if (col.id === 'pending' || col.id === 'overdue') {
          colItems.sort((a, b) => {
            const scoreA = (a.s.invoiceTotal || 0) * (a.s.maxDaysLate || -30);
            const scoreB = (b.s.invoiceTotal || 0) * (b.s.maxDaysLate || -30);
            return scoreB - scoreA;
          });
        }

        return (
          <div key={col.id} className="kanban-column" style={{ minWidth: 320, width: 320, background: col.bg, borderRadius: 20, padding: 16, border: `1px solid ${col.color}20`, display: 'flex', flexDirection: 'column', maxHeight: '75vh', boxShadow: 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
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
                    layoutId={`order-${item.o.id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4, scale: 1.02, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
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
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
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
    </KanbanScrollWrapper>
  );
}
