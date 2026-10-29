import React, { useMemo } from 'react';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import {
  buildReconciliationDiscrepancies,
  RECONCILIATION_LABELS,
  type ReconciliationKind,
} from '../../lib/reconciliationBoard';
import { money, kilos } from '../../lib/format';

interface Props {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenOrder: (orderId: string) => void;
}

const KIND_ORDER: ReconciliationKind[] = [
  'invoice_without_oc',
  'delivered_not_invoiced',
  'invoice_over_delivered',
  'invoice_price_mismatch',
  'partial_payment',
];

/**
 * Tablero único de conciliación OC ↔ entregas ↔ facturas ↔ pagos.
 * Una lista matutina de diferencias accionables; cada renglón abre su
 * expediente. Si no hay diferencias, lo dice: también es información.
 */
export const ReconciliationBoard: React.FC<Props> = ({ orders, config, onOpenOrder }) => {
  const discrepancies = useMemo(
    () => buildReconciliationDiscrepancies(orders, config),
    [orders, config]
  );

  const groups = useMemo(() => {
    const map = new Map<ReconciliationKind, typeof discrepancies>();
    for (const d of discrepancies) {
      const list = map.get(d.kind) ?? [];
      list.push(d);
      map.set(d.kind, list);
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => ({
      kind: k,
      label: RECONCILIATION_LABELS[k],
      items: map.get(k)!,
    }));
  }, [discrepancies]);

  return (
    <section
      style={{
        background: 'var(--card, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ margin: '0 0 4px' }}>
        Tablero de conciliación{' '}
        <span style={{ fontWeight: 400, fontSize: '0.85em' }}>
          · OC ↔ entregas ↔ facturas ↔ pagos
        </span>
      </h3>
      <p style={{ margin: '0 0 12px', opacity: 0.75 }}>
        {discrepancies.length === 0
          ? 'Sin diferencias hoy: todo cuadra.'
          : `${discrepancies.length} diferencia(s) por revisar.`}
      </p>
      {groups.map((group) => (
        <div key={group.kind} style={{ marginBottom: 12 }}>
          <strong>
            {group.label} ({group.items.length})
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {group.items.map((d, i) => (
              <li key={`${d.orderId}-${d.kind}-${i}`} style={{ marginBottom: 6 }}>
                <span>
                  {d.orderLabel} — {d.title}. {d.detail}{' '}
                  {d.kilos != null && <span>({kilos(d.kilos)})</span>}{' '}
                  {d.amount != null && <span>({money(d.amount)})</span>}
                </span>{' '}
                <button type="button" onClick={() => onOpenOrder(d.orderId)}>
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};
