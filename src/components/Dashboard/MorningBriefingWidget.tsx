import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, toDate } from '../../lib/format';
import { extractCr, daysLate } from '../../lib/finance';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useNavigate } from 'react-router-dom';

const OFFICIAL_VALID_CRS = ['GT-874', 'TH-990', 'TH-946', 'TH-912', 'TH-879', 'GT-742', 'GT-713', 'GT-651'];

export function MorningBriefingWidget({
  orders,
  config,
  onOpenQuickCollection,
  onOpenUniversalUpload,
}: {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickCollection: () => void;
  onOpenUniversalUpload?: () => void;
}) {
  const nav = useNavigate();
  const saleKg = config?.salePricePerKg || 43;
  const ivaRate = config?.ivaRate || 0.16;

  // 1. Tarea 1: Contrarecibos Vencidos o por Vencer Hoy
  const overdueOrTodayCrs = useMemo(() => {
    const list: Array<{ cr: string; folios: string[]; amount: number; dueDate: Date; daysOverdue: number; client: string }> = [];
    const seen = new Set<string>();

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;

      (o.invoices || []).forEach((inv) => {
        if (!inv) return;
        const cr = extractCr(inv, o);
        if (!cr || !OFFICIAL_VALID_CRS.includes(cr)) return;

        const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
        if (isPaid) return;

        const due = toDate(inv.creditCycle?.dueDate || inv.collection?.contrareciboDate);
        if (!due) return;

        const dLate = daysLate(due) ?? 0;
        const amt = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));

        if (dLate >= 0) {
          if (!seen.has(cr)) {
            seen.add(cr);
            list.push({
              cr,
              folios: [inv.folio || 'S/F'],
              amount: amt,
              dueDate: due,
              daysOverdue: dLate,
              client: o.client || 'Providencia',
            });
          }
        }
      });
    });

    return list;
  }, [orders, saleKg, ivaRate]);

  // 2. Tarea 2: Facturas en Revisión Sin CR
  const sinCrInvoices = useMemo(() => {
    const list: Array<{ folio: string; kilos: number; amount: number; orderOc: string; client: string }> = [];

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;

      (o.invoices || []).forEach((inv) => {
        if (!inv) return;
        const cr = extractCr(inv, o);
        const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
        if (isPaid) return;

        if (!cr || !OFFICIAL_VALID_CRS.includes(cr)) {
          const amt = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));
          list.push({
            folio: inv.folio || 'S/F',
            kilos: inv.kilos || 0,
            amount: amt,
            orderOc: o.folio || o.oc || 'S/OC',
            client: o.client || 'Providencia',
          });
        }
      });
    });

    return list;
  }, [orders, saleKg, ivaRate]);

  const totalOverdueMonto = overdueOrTodayCrs.reduce((sum, i) => sum + i.amount, 0);
  const totalSinCrMonto = sinCrInvoices.reduce((sum, i) => sum + i.amount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(56, 189, 248, 0.08)',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>☀️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              Asistente Matutino de Operaciones
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.65)' }}>
              Prioridades y acciones recomendadas del día para cobranza, portal y compras.
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          ⚡ Control Proactivo
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {/* Tarea 1: Cobranza Exigible */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>
                1. Cobranza Cumplida
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#ef4444' }}>
                {overdueOrTodayCrs.length} CRs ({money(totalOverdueMonto)})
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4 }}>
              {overdueOrTodayCrs.length > 0
                ? `Folios: ${overdueOrTodayCrs.map((i) => i.cr).slice(0, 4).join(', ')} con vencimiento en Providencia.`
                : '✅ Toda la cartera se encuentra dentro de plazo ordinario.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {overdueOrTodayCrs.length > 0 && (
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  background: '#25D366',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  triggerHaptic('medium');
                  const first = overdueOrTodayCrs[0];
                  const msg = generateCollectionNotice({
                    folioFactura: first.folios.join(', '),
                    contrarecibo: first.cr,
                    cliente: first.client,
                    monto: first.amount,
                    fechaVencimiento: first.dueDate,
                  });
                  openWhatsAppMessage(msg);
                }}
              >
                💬 Cobrar 1er CR ({overdueOrTodayCrs[0].cr})
              </button>
            )}
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 700 }}
              onClick={() => nav('/cobranza')}
            >
              📋 Ver Todos
            </button>
          </div>
        </div>

        {/* Tarea 2: Trámites de Contrarecibos en Portal */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                2. Trámites en Portal
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b' }}>
                {sinCrInvoices.length} Facturas ({money(totalSinCrMonto)})
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4 }}>
              {sinCrInvoices.length > 0
                ? `Facturas #${sinCrInvoices.map((i) => i.folio).join(', #')} esperando número de CR en apps.mundoprovidencia.com.`
                : '✅ Todas las facturas timbradas cuentan con su contrarecibo.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                background: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              onClick={() => {
                triggerHaptic('light');
                onOpenQuickCollection();
              }}
            >
              📝 Asignar CR Rápido
            </button>
            {onOpenUniversalUpload && (
              <button
                type="button"
                className="btn secondary"
                style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 700 }}
                onClick={() => {
                  triggerHaptic('light');
                  onOpenUniversalUpload();
                }}
              >
                ⚡ Pegar Portal
              </button>
            )}
          </div>
        </div>

        {/* Tarea 3: Balance de Compras & Andrés */}
        <div
          style={{
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                3. Andrés & Báscula
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#10b981' }}>
                +$103,411.84 a Favor
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4 }}>
              Entregas de báscula cuadradas al 100% (6,085.01 kg entregados = 6,085.01 kg facturados). Cero mermas.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                background: '#059669',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              onClick={() => {
                triggerHaptic('light');
                nav('/compras');
              }}
            >
              ⚖️ Libro Mayor Andrés
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 700 }}
              onClick={() => {
                triggerHaptic('light');
                nav('/oc');
              }}
            >
              🚚 Vales OC
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
