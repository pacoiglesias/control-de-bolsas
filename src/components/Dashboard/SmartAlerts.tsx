import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';
import { useNavigate } from 'react-router-dom';

export function SmartAlerts({ orders }: { orders: PurchaseOrder[] }) {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const q = query(collection(db, PATHS.maquilaDeliveries), where('status', '==', 'pending_approval'));
    const unsub = onSnapshot(q, snap => {
      setPendingApprovals(snap.size);
    });
    return () => unsub();
  }, []);

  const alerts = useMemo(() => {
    const list = [];
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    let overdueCount = 0;
    let overdueTotal = 0;
    let nearDueCount = 0;
    let nearDueTotal = 0;

    for (const o of orders) {
      if (!o.invoices) continue;
      for (const inv of o.invoices) {
        if (inv.creditCycle.status !== 'paid' && inv.creditCycle.dueDate) {
          const dueMs = inv.creditCycle.dueDate.toMillis?.() || 0;
          if (dueMs < now) {
            overdueCount++;
            overdueTotal += (inv.financials?.invoiceTotal || 0);
          } else if (dueMs <= now + threeDaysMs) {
            nearDueCount++;
            nearDueTotal += (inv.financials?.invoiceTotal || 0);
          }
        }
      }
    }

    if (pendingApprovals > 0) {
      list.push({
        id: 'maquila_approval',
        type: 'warning',
        icon: '⚠️',
        message: `El maquilador reportó ${pendingApprovals} entrega(s) con excedente de kilos.`,
        action: 'Revisar',
        onClick: () => nav('/oc') // O a donde corresponda
      });
    }

    if (overdueCount > 0) {
      list.push({
        id: 'overdue_invoices',
        type: 'danger',
        icon: '🔴',
        message: `Tienes ${overdueCount} factura(s) vencida(s) por un total de ${money(overdueTotal)}.`,
        action: 'Ir a Cobranza',
        onClick: () => nav('/cobranza')
      });
    }

    if (nearDueCount > 0) {
      list.push({
        id: 'near_due_invoices',
        type: 'info',
        icon: '🟡',
        message: `Hay ${nearDueCount} factura(s) por vencer en los próximos 3 días (${money(nearDueTotal)}).`,
        action: 'Ver',
        onClick: () => nav('/cobranza')
      });
    }

    return list;
  }, [orders, pendingApprovals, nav]);

  if (alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {alerts.map(a => {
        const bg = a.type === 'danger' ? 'rgba(239, 68, 68, 0.15)' : a.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)';
        const color = a.type === 'danger' ? '#fca5a5' : a.type === 'warning' ? '#fcd34d' : '#93c5fd';
        const border = a.type === 'danger' ? 'rgba(239, 68, 68, 0.3)' : a.type === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)';

        return (
          <div key={a.id} style={{ 
            background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, color: '#fff'
          }}>
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{a.message}</div>
            <button onClick={a.onClick} style={{
              background: 'transparent', border: `1px solid ${color}`, color, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              {a.action}
            </button>
          </div>
        );
      })}
    </div>
  );
}
