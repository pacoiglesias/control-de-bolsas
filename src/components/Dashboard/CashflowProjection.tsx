import { useState, useMemo } from 'react';
import { PurchaseOrder } from '../../lib/types';
import { money, fmtDate, nombreClienteVisible } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
import { motion, AnimatePresence } from 'framer-motion';

export function CashflowProjection({ orders }: { orders: PurchaseOrder[] }) {
  const [expanded, setExpanded] = useState(false);

  const { items7d, items15d, items30d, total7d, total15d, total30d, grandTotal } = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const fifteenDaysMs = 15 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    const items7d: any[] = [];
    const items15d: any[] = [];
    const items30d: any[] = [];

    for (const o of orders) {
      if (!o || !o.invoices) continue;
      for (const inv of o.invoices) {
        if (!inv) continue;
        if (inv.creditCycle?.status !== 'paid' && inv.creditCycle?.dueDate) {
          const rawDue = inv.creditCycle.dueDate as any;
          let dueMs = 0;
          if (rawDue) {
            if (typeof rawDue.toMillis === 'function') dueMs = rawDue.toMillis();
            else if (typeof rawDue.toDate === 'function') dueMs = rawDue.toDate().getTime();
            else if (rawDue instanceof Date) dueMs = rawDue.getTime();
            else { const d = new Date(rawDue); if (!isNaN(d.getTime())) dueMs = d.getTime(); }
          }
          const diff = dueMs - now;

          if (diff > 0 && diff <= thirtyDaysMs) {
            const saldo = (inv.financials?.invoiceTotal || 0) - (inv.collection?.paidAmount || 0);
            if (saldo <= 0) continue;

            const item = {
              orderId: o.id,
              invoiceId: inv.id,
              folio: inv.folio || o.folio || 'S/N',
              cr: extractCr(inv, o),
              client: o.client,
              amount: saldo,
              dueDate: inv.creditCycle.dueDate,
              dueMs,
            };

            if (diff <= sevenDaysMs) {
              items7d.push(item);
            } else if (diff <= fifteenDaysMs) {
              items15d.push(item);
            } else {
              items30d.push(item);
            }
          }
        }
      }
    }

    // Ordenar por fecha más próxima
    const sorter = (a: any, b: any) => a.dueMs - b.dueMs;
    items7d.sort(sorter);
    items15d.sort(sorter);
    items30d.sort(sorter);

    const sum = (arr: any[]) => arr.reduce((acc, it) => acc + it.amount, 0);
    const total7d = sum(items7d);
    const total15d = sum(items15d);
    const total30d = sum(items30d);
    const grandTotal = total7d + total15d + total30d;

    return { items7d, items15d, items30d, total7d, total15d, total30d, grandTotal };
  }, [orders]);

  if (grandTotal === 0) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.18) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 16,
        padding: '18px 22px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📈</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
              Proyección Predictiva de Flujo (Próximos 30 Días)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Cobros programados según fechas oficiales de contrarecibos de Providencia.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Ingreso Esperado
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', letterSpacing: '-0.5px' }}>
              +{money(grandTotal)}
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: expanded ? 'rgba(59, 130, 246, 0.2)' : 'var(--paper-raised)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 10,
              padding: '8px 14px',
              color: '#2563eb',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{expanded ? '▲ Ocultar Detalle' : '▼ Ver Calendario'}</span>
          </button>
        </div>
      </div>

      {/* 3 Pilares de Ventana Temporal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ background: 'var(--paper-raised)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>1 a 7 Días</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>{money(total7d)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{items7d.length} factura(s)</div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>8 a 15 Días</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>{money(total15d)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{items15d.length} factura(s)</div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>16 a 30 Días</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>{money(total30d)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{items30d.length} factura(s)</div>
        </div>
      </div>

      {/* Lista Desplegable con Acciones de WhatsApp */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 18, borderTop: '1px dashed rgba(59, 130, 246, 0.3)', paddingTop: 14 }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 10 }}>
              Facturas en Tránsito de Cobro
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...items7d, ...items15d, ...items30d].map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--paper-raised)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    border: '1px solid var(--line-soft)',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--ink)' }}>
                      #{it.folio} {it.cr ? <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>(CR: {it.cr})</span> : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {nombreClienteVisible(it.client)} · Vence: <strong>{fmtDate(it.dueDate)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ok)' }}>
                      {money(it.amount)}
                    </div>
                    <button
                      onClick={() => {
                        const notice = generateCollectionNotice({
                          cliente: nombreClienteVisible(it.client) || 'Grupo Textil Providencia',
                          folioFactura: it.folio,
                          contrarecibo: it.cr || undefined,
                          monto: it.amount,
                          fechaVencimiento: it.dueDate,
                        });
                        openWhatsAppMessage(notice);
                      }}
                      title="Enviar recordatorio de cobro por WhatsApp"
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 8,
                        padding: '5px 10px',
                        color: '#16a34a',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>📲</span> Recordar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
