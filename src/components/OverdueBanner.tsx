import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrdersContext } from '../context/OrdersContext';
import { toDate, money, fmtDate } from '../lib/format';
import { Modal } from './ui';
import { extractCr, daysLate } from '../lib/finance';
import { triggerHaptic } from '../lib/hapticEngine';
import { generateCollectionNotice, openWhatsAppMessage } from '../lib/whatsappReminder';

interface OverdueCrItem {
  cr: string;
  orderId: string;
  folios: string[];
  dueDate: Date;
  daysOverdue: number;
  amount: number;
  client: string;
  dept: string;
}

/**
 * Aviso de contrarecibos realmente vencidos en el sistema activo.
 * Solo muestra contrarecibos únicos en crédito pendientes de cobro cuya fecha de pago
 * ya venció según el reloj actual.
 */
export function OverdueBanner() {
  const nav = useNavigate();
  const { orders } = useOrdersContext();
  const [dismissedKey, setDismissedKey] = useState<string | null>(() => localStorage.getItem('cb-overdue-banner-dismissed-v3'));
  const [showModal, setShowModal] = useState(false);

  const overdueCrs = useMemo<OverdueCrItem[]>(() => {
    const now = new Date();
    const map = new Map<string, OverdueCrItem>();

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;
      (o.invoices || []).forEach((inv) => {
        const cycle = inv.creditCycle;
        if (!cycle || (cycle.status !== 'pending' && cycle.status !== 'facturado' && cycle.status !== 'overdue')) return;
        const due = toDate(cycle.dueDate);
        if (!due) return;

        // Vencido si la fecha de pago es anterior o igual a hoy
        const endOfDueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59);
        if (endOfDueDate <= now) {
          const crName = extractCr(inv, o) || inv.collection?.contrareciboNumber || `CR-${inv.folio}`;
          if (!crName || crName.startsWith('CR-undefined')) return;

          const crKey = crName.toUpperCase().trim();
          const invAmt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const late = daysLate(due) || 0;
          const folio = inv.folio || 'S/F';

          if (!map.has(crKey)) {
            map.set(crKey, {
              cr: crKey,
              orderId: o.id,
              folios: [folio],
              dueDate: due,
              daysOverdue: late,
              amount: invAmt,
              client: o.client || 'Providencia',
              dept: crKey.startsWith('TH') ? 'TH' : 'GT',
            });
          } else {
            const existing = map.get(crKey)!;
            if (!existing.folios.includes(folio)) {
              existing.folios.push(folio);
            }
            existing.amount += invAmt;
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [orders]);

  const totalOverdueMonto = useMemo(() => {
    return overdueCrs.reduce((acc, c) => acc + c.amount, 0);
  }, [overdueCrs]);

  const currentKey = overdueCrs.map((i) => i.cr).sort().join(',');

  if (overdueCrs.length === 0 || currentKey === dismissedKey) return null;

  const dismiss = () => {
    triggerHaptic('light');
    localStorage.setItem('cb-overdue-banner-dismissed-v3', currentKey);
    setDismissedKey(currentKey);
  };

  const listaFolios = overdueCrs.slice(0, 5).map((i) => i.cr).join(', ') + (overdueCrs.length > 5 ? `, +${overdueCrs.length - 5} más` : '');

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.08) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          borderRadius: 14,
          padding: '12px 18px',
          margin: '0 0 16px 0',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(239, 68, 68, 0.12)',
        }}
      >
        <span>
          🔴 <strong>Atención de Cobranza:</strong> {overdueCrs.length} contrarecibo{overdueCrs.length === 1 ? '' : 's'} con fecha de vencimiento cumplida en Providencia ({money(totalOverdueMonto)}): <strong>{listaFolios}</strong>.
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 800,
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
            }}
            onClick={() => {
              triggerHaptic('medium');
              setShowModal(true);
            }}
          >
            📋 Ver contrarecibos
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={dismiss}
          >
            Ya lo vi
          </button>
        </div>
      </div>

      {/* Modal de Detalle de Contrarecibos Vencidos */}
      {showModal && (
        <Modal
          title={`🚨 Contrarecibos Vencidos en Providencia (${overdueCrs.length})`}
          onClose={() => setShowModal(false)}
        >
          <div style={{ padding: '4px 0' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#f87171' }}>
                  Total Vencido en Cartera
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                  {money(totalOverdueMonto)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#fee2e2',
                  color: '#991b1b',
                }}
              >
                {overdueCrs.length} CRs Vencidos
              </span>
            </div>

            <div className="table-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Contrarecibo</th>
                    <th>Factura(s)</th>
                    <th>Depto</th>
                    <th>Vencimiento</th>
                    <th className="num">Atraso</th>
                    <th className="num">Importe con IVA</th>
                    <th style={{ textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueCrs.map((item) => (
                    <tr key={item.cr}>
                      <td className="mono" style={{ fontWeight: 800, color: '#f87171' }}>
                        {item.cr}
                      </td>
                      <td className="mono" style={{ color: 'var(--ink)' }}>
                        {item.folios.map(f => `#${f}`).join(', ')}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: item.dept === 'TH' ? '#e0f2fe' : '#dcfce7',
                            color: item.dept === 'TH' ? '#0369a1' : '#15803d',
                          }}
                        >
                          {item.dept}
                        </span>
                      </td>
                      <td>{fmtDate(item.dueDate)}</td>
                      <td className="num" style={{ fontWeight: 800, color: '#ef4444' }}>
                        {item.daysOverdue > 0 ? `+${item.daysOverdue} días` : 'Hoy'}
                      </td>
                      <td className="num mono" style={{ fontWeight: 800, color: '#fff' }}>
                        {money(item.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            background: '#25D366',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const msg = generateCollectionNotice({
                              folioFactura: item.folios.join(', '),
                              contrarecibo: item.cr,
                              cliente: item.client,
                              monto: item.amount,
                              fechaVencimiento: item.dueDate,
                            });
                            openWhatsAppMessage(msg);
                          }}
                        >
                          💬 WhatsApp
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  fontWeight: 800,
                }}
                onClick={() => {
                  setShowModal(false);
                  nav('/cobranza');
                }}
              >
                💰 Ir al Tablero de Cobranza
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

