import { useMemo } from 'react';
import { PurchaseOrder } from '../../lib/types';
import { money, fmtDayAndDate, nombreClienteVisible, toDate } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';

interface WeeklyCollectionSummaryProps {
  orders: PurchaseOrder[];
}

export function WeeklyCollectionSummary({ orders }: WeeklyCollectionSummaryProps) {
  const toast = useToast();
  const weeklyCrs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const list: any[] = [];

    for (const o of orders) {
      if (o.client === 'MIGRACION') continue;
      if (!o.invoices) continue;
      for (const inv of o.invoices) {
        if (inv.creditCycle?.status !== 'paid' && inv.creditCycle?.status !== 'collected') {
          const cr = extractCr(inv, o);
          if (cr && inv.creditCycle?.dueDate) {
            const due = toDate(inv.creditCycle.dueDate);
            if (due) {
              const diff = due.getTime() - today.getTime();
              // Si vence en los próximos 7 días o ya está vencido
              if (diff <= sevenDaysMs) {
                const saldo = (inv.financials?.invoiceTotal || 0) - (inv.collection?.paidAmount || 0);
                if (saldo > 0) {
                  list.push({
                    folio: inv.folio || o.folio || 'S/N',
                    cr: cr,
                    client: nombreClienteVisible(o.client) || 'Providencia',
                    amount: saldo,
                    dueDate: due,
                  });
                }
              }
            }
          }
        }
      }
    }

    return list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [orders]);

  if (weeklyCrs.length === 0) return null;

  const totalSemana = weeklyCrs.reduce((a, it) => a + it.amount, 0);

  const handleCopyWeeklyReport = () => {
    const lines = weeklyCrs.map(
      (it, idx) => `${idx + 1}. CR ${it.cr} (Fact. #${it.folio}) - ${money(it.amount)} - Vence: ${fmtDayAndDate(it.dueDate)}`
    ).join('\n');

    const text = `Relación de Contrarecibos Programados para Cobro (Semanal):\n\n${lines}\n\nTotal Programado: ${money(totalSemana)}\nFecha de emisión: ${new Date().toLocaleDateString('es-MX')}`;
    navigator.clipboard.writeText(text);
    toast('📋 Relación semanal copiada al portapapeles.', 'ok');
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 14,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📅</span> Cobranza de la Semana para el Contador ({weeklyCrs.length} contrarecibos)
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
          Total programado para cobro en los próximos 7 días: <strong style={{ color: '#059669' }}>{money(totalSemana)}</strong>
        </div>
      </div>

      <button
        onClick={handleCopyWeeklyReport}
        style={{
          background: 'var(--paper-raised)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span>📋</span> Copiar Relación Semanal
      </button>
    </div>
  );
}
