import { useMemo } from 'react';
import { PurchaseOrder } from '../../lib/types';
import { money, fmtDate, nombreClienteVisible } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { openWhatsAppMessage } from '../../lib/whatsappReminder';

interface WeeklyCollectionSummaryProps {
  orders: PurchaseOrder[];
}

export function WeeklyCollectionSummary({ orders }: WeeklyCollectionSummaryProps) {
  const weeklyCrs = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const list: any[] = [];

    for (const o of orders) {
      if (o.client === 'MIGRACION') continue;
      if (!o.invoices) continue;
      for (const inv of o.invoices) {
        if (inv.creditCycle?.status !== 'paid' && inv.creditCycle?.status !== 'collected') {
          const cr = extractCr(inv, o);
          if (cr && inv.creditCycle?.dueDate) {
            const dueMs = inv.creditCycle.dueDate.toMillis?.() || 0;
            const diff = dueMs - now;
            // Si vence en los próximos 7 días o ya está vencido
            if (diff <= sevenDaysMs) {
              const saldo = (inv.financials?.invoiceTotal || 0) - (inv.collection?.paidAmount || 0);
              if (saldo > 0) {
                list.push({
                  folio: inv.folio || o.folio || 'S/N',
                  cr: cr,
                  client: nombreClienteVisible(o.client) || 'Providencia',
                  amount: saldo,
                  dueDate: inv.creditCycle.dueDate,
                });
              }
            }
          }
        }
      }
    }

    return list;
  }, [orders]);

  if (weeklyCrs.length === 0) return null;

  const totalSemana = weeklyCrs.reduce((a, it) => a + it.amount, 0);

  const handleSendWhatsApp = () => {
    const lines = weeklyCrs.map(
      (it, idx) => `${idx + 1}. *CR ${it.cr}* (Fact. #${it.folio}) - *${money(it.amount)}* - Vence: ${fmtDate(it.dueDate)}`
    ).join('\n');

    const text = `Hola estimado Contador,\n\nTe comparto la relación de contrarecibos programados para cobro esta semana:\n\n${lines}\n\n💰 *Total Programado a Cobrar:* ${money(totalSemana)}\n\nQuedamos al pendiente de la recolección del efectivo. Saludos.`;
    openWhatsAppMessage(text);
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
        onClick={handleSendWhatsApp}
        style={{
          background: '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        }}
      >
        <span>📲</span> Enviar Lista al Contador (WhatsApp)
      </button>
    </div>
  );
}
