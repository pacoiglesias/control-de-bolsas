import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { PurchaseOrder } from '../../lib/types';
import { money, toDate } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../hooks/useConfig';

export function SmartAlerts({ orders, deudaAndres }: { orders: PurchaseOrder[]; deudaAndres?: number }) {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const nav = useNavigate();
  const { config } = useConfig();

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

    // FIX 2026-08-10 (Staff Engineer -- task ERP #13): alerta de margen
    // anómalo. Antes un error de captura (costo mal escrito, precio de
    // venta con un cero de más/de menos, kilos duplicados) solo se notaba
    // hasta que alguien revisaba la factura una por una en el expediente --
    // no había ninguna señal proactiva en el Dashboard. El margen
    // "esperado" se deriva de la configuración global vigente
    // (salePricePerKg vs costPricePerKg); se marca como anómala cualquier
    // factura ya facturada cuyo margen real (financials.tradeMargin /
    // financials.saleTotal, calculado por computeFinancials en finance.ts)
    // esté muy por debajo de ese esperado, o sea negativo (pérdida).
    const salePrice = config?.salePricePerKg || 43;
    const costPrice = config?.costPricePerKg || 42;
    const expectedMarginRate = salePrice > 0 ? (salePrice - costPrice) / salePrice : 0;
    let marginAnomalyCount = 0;
    let worstMarginFolio = '';
    let worstMarginRate = Infinity;

    for (const o of (orders || [])) {
      if (!o || !o.invoices) continue;
      for (const inv of o.invoices) {
        if (!inv) continue;
        if (inv.creditCycle?.status !== 'paid' && inv.creditCycle?.dueDate) {
          const due = toDate(inv.creditCycle.dueDate);
          const dueMs = due ? due.getTime() : 0;

          if (dueMs > 0 && dueMs < now) {
            overdueCount++;
            overdueTotal = round2(overdueTotal + (inv.financials?.invoiceTotal || 0));
          } else if (dueMs > 0 && dueMs <= now + threeDaysMs) {
            nearDueCount++;
            nearDueTotal = round2(nearDueTotal + (inv.financials?.invoiceTotal || 0));
          }
        }

        const saleTotal = inv.financials?.saleTotal ?? 0;
        if (expectedMarginRate > 0 && saleTotal > 0) {
          const actualMarginRate = (inv.financials?.tradeMargin ?? 0) / saleTotal;
          // Anómala: margen negativo (pérdida real) o menos de la mitad
          // del margen que la configuración actual dice que debería dar.
          const esAnomala = actualMarginRate < 0 || actualMarginRate < expectedMarginRate * 0.5;
          if (esAnomala) {
            marginAnomalyCount++;
            if (actualMarginRate < worstMarginRate) {
              worstMarginRate = actualMarginRate;
              worstMarginFolio = inv.folio || o.folio || o.oc || 'sin folio';
            }
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

    if (marginAnomalyCount > 0) {
      list.push({
        id: 'margin_anomaly',
        type: 'warning',
        icon: '📉',
        message: marginAnomalyCount === 1
          ? `La factura ${worstMarginFolio} tiene un margen anómalo (muy por debajo de lo esperado o en pérdida). Revisa el costo/precio capturado.`
          : `${marginAnomalyCount} factura(s) con margen anómalo (muy por debajo de lo esperado o en pérdida), incluida ${worstMarginFolio}. Revisa el costo/precio capturado.`,
        action: 'Revisar Órdenes',
        onClick: () => nav('/ordenes')
      });
    }
    // SPRINT 4 — Saldo anómalo con Andrés
    // Un saldo absolutamente muy grande (positivo o negativo) generalmente
    // es señal de que la calibración histórica está mal configurada.
    const ANDRES_ANOMALY_THRESHOLD = 500_000;
    if (deudaAndres !== undefined && Math.abs(deudaAndres) > ANDRES_ANOMALY_THRESHOLD) {
      list.push({
        id: 'andres_balance_anomaly',
        type: 'warning' as const,
        icon: '⚖️',
        message: deudaAndres > 0
          ? `El saldo a favor de Andrés es muy alto (${money(deudaAndres)}). ¿Es correcto? Si no, usa ⚡ Edición Rápida para calibrar.`
          : `La empresa tiene una deuda muy alta con Andrés (${money(deudaAndres)}). Verifica la calibración en ⚡ Edición Rápida.`,
        action: 'Calibrar',
        onClick: () => {
          const btn = document.querySelector<HTMLButtonElement>('[title="Edición Rápida del Sistema"]');
          if (btn) btn.click();
        }
      });
    }

    // Un folio de factura apareciendo en dos expedientes distintos es una
    // señal inequívoca de captura errónea (doble entrada, copiar/pegar
    // mal). Se detecta aquí para que el admin la vea de inmediato.
    const folioMap = new Map<string, string[]>(); // folio => [orderId, ...]
    for (const o of (orders || [])) {
      for (const inv of o.invoices ?? []) {
        const f = inv.folio?.trim();
        if (!f) continue;
        const existing = folioMap.get(f) ?? [];
        existing.push(o.id || o.oc || 'sin-id');
        folioMap.set(f, existing);
      }
    }
    const dupFolios = [...folioMap.entries()].filter(([, ids]) => ids.length > 1);
    if (dupFolios.length > 0) {
      const sample = dupFolios[0][0];
      list.push({
        id: 'duplicate_folios',
        type: 'warning',
        icon: '🔁',
        message: dupFolios.length === 1
          ? `El folio ${sample} aparece en ${dupFolios[0][1].length} expedientes distintos. Posible captura duplicada.`
          : `${dupFolios.length} folios de factura están duplicados en varios expedientes (ej. ${sample}). Revisa la captura.`,
        action: 'Ver Órdenes',
        onClick: () => nav('/ordenes')
      });
    }

    return list;
  }, [orders, pendingApprovals, nav, config.salePricePerKg, config.costPricePerKg]);


  if (alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {alerts.map(a => {
        // FIX 2026-08-09: los colores estaban fijos en hex (pensados solo
        // para tema oscuro) y el texto del mensaje forzaba blanco (`#fff`)
        // sobre un fondo casi blanco en tema claro (el predeterminado del
        // sistema) -- las alertas de facturas vencidas quedaban ilegibles.
        // Se reemplaza por las variables de tema ya usadas en `.kpi-card`
        // (--bad/--warn/--info y sus -bg), que ya están calibradas para
        // tener buen contraste en ambos temas.
        const bg = a.type === 'danger' ? 'var(--bad-bg)' : a.type === 'warning' ? 'var(--warn-bg)' : 'var(--info-bg)';
        const color = a.type === 'danger' ? 'var(--bad)' : a.type === 'warning' ? 'var(--warn)' : 'var(--info)';

        return (
          <div key={a.id} style={{
            background: bg, border: `1px solid ${color}`, borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, color
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
