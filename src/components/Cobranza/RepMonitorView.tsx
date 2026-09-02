import { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { money, fmtDate, toDate } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { generateComplementoPagoContadorMessage, openWhatsAppMessage } from '../../lib/whatsappReminder';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui';

interface RepInvoiceItem {
  orderId: string;
  orderFolio: string;
  client: string;
  invoice: Invoice;
  contrarecibo: string;
  paidDate: Date;
  paidAmount: number;
  hasRep: boolean;
  repUuid?: string;
}

export default function RepMonitorView({ orders }: { orders: PurchaseOrder[] }) {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'pending_rep' | 'completed_rep'>('all');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<RepInvoiceItem | null>(null);
  const [repUuidInput, setRepUuidInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 1. Extraer facturas pagadas / cobradas
  const repList = useMemo(() => {
    const list: RepInvoiceItem[] = [];

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;

      (o.invoices || []).forEach((inv) => {
        if (!inv) return;
        const st = inv.creditCycle?.status;
        const isPaid = st === 'paid' || st === 'collected' || (inv.collection?.paidAmount && inv.collection.paidAmount > 0);
        
        // Incluir facturas liquidadas o facturas históricas con CR
        if (isPaid || o.creditCycle?.status === 'collected') {
          const cr = extractCr(inv, o);
          const pDate = toDate(inv.collection?.paidAt || inv.creditCycle?.dueDate || o.updatedAt) || new Date();
          const pAmt = inv.collection?.paidAmount || inv.financials?.invoiceTotal || inv.financials?.saleTotal || 0;
          const repUuid = (inv as any).repUuid || (inv.collection as any)?.repUuid;

          list.push({
            orderId: o.id,
            orderFolio: o.folio || o.oc || 'S/OC',
            client: o.client || 'Providencia',
            invoice: inv,
            contrarecibo: cr,
            paidDate: pDate,
            paidAmount: pAmt,
            hasRep: Boolean(repUuid && repUuid.length > 5),
            repUuid,
          });
        }
      });
    });

    return list.sort((a, b) => b.paidDate.getTime() - a.paidDate.getTime());
  }, [orders]);

  // 2. Filtro y Búsqueda
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repList.filter((item) => {
      if (filter === 'pending_rep' && item.hasRep) return false;
      if (filter === 'completed_rep' && !item.hasRep) return false;

      if (!q) return true;
      const f = (item.invoice.folio || '').toLowerCase();
      const cr = (item.contrarecibo || '').toLowerCase();
      const oc = (item.orderFolio || '').toLowerCase();
      return f.includes(q) || cr.includes(q) || oc.includes(q);
    });
  }, [repList, filter, search]);

  const totalPendientesRep = useMemo(() => {
    return repList.filter((i) => !i.hasRep).length;
  }, [repList]);

  const totalMontoRepPendiente = useMemo(() => {
    return repList.filter((i) => !i.hasRep).reduce((acc, i) => acc + i.paidAmount, 0);
  }, [repList]);

  // Guardar REP UUID en Firestore
  const handleSaveRep = async () => {
    if (!editingItem || !repUuidInput.trim()) return;
    try {
      setSaving(true);
      const targetOrder = orders.find((o) => o.id === editingItem.orderId);
      if (!targetOrder) throw new Error('Orden no encontrada');

      const updatedInvoices = (targetOrder.invoices || []).map((inv) => {
        if (inv.id === editingItem.invoice.id || inv.folio === editingItem.invoice.folio) {
          return {
            ...inv,
            repUuid: repUuidInput.trim().toUpperCase(),
            collection: {
              ...(inv.collection || {}),
              repUuid: repUuidInput.trim().toUpperCase(),
            },
          };
        }
        return inv;
      });

      const orderRef = doc(db, PATHS.orders, editingItem.orderId);
      await updateDoc(orderRef, {
        invoices: updatedInvoices,
      });

      triggerHaptic('success');
      toast(`✅ Complemento REP #${repUuidInput.trim()} vinculado a Factura #${editingItem.invoice.folio}.`, 'ok');
      setEditingItem(null);
      setRepUuidInput('');
    } catch (err: any) {
      triggerHaptic('error');
      toast(`Error al guardar REP: ${err?.message || 'Error desconocido'}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cabecera & KPIs del Monitor Fiscal REP */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 16,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
              🏦 Monitor de Complementos de Pago (REP)
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: totalPendientesRep > 0 ? '#fef3c7' : '#dcfce7',
                color: totalPendientesRep > 0 ? '#92400e' : '#166534',
                border: totalPendientesRep > 0 ? '1px solid #fde68a' : '1px solid #bbf7d0',
              }}
            >
              {totalPendientesRep > 0 ? `${totalPendientesRep} Pendientes de REP` : '100% al Corriente'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
            Supervisión y timbrado de CFDIs de Recepción de Pagos (REP) con contadores ante el SAT.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Monto Pagado por Amparar con REP
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: totalMontoRepPendiente > 0 ? '#d97706' : '#059669' }}>
              {money(totalMontoRepPendiente)}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${filter === 'all' ? '' : 'secondary'}`}
            style={{ fontSize: 12, padding: '6px 12px', fontWeight: 700 }}
            onClick={() => setFilter('all')}
          >
            Todos ({repList.length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'pending_rep' ? '' : 'secondary'}`}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              fontWeight: 700,
              background: filter === 'pending_rep' ? '#d97706' : undefined,
              color: filter === 'pending_rep' ? '#fff' : undefined,
            }}
            onClick={() => setFilter('pending_rep')}
          >
            ⚠️ Pendientes de REP ({totalPendientesRep})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'completed_rep' ? '' : 'secondary'}`}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              fontWeight: 700,
              background: filter === 'completed_rep' ? '#059669' : undefined,
              color: filter === 'completed_rep' ? '#fff' : undefined,
            }}
            onClick={() => setFilter('completed_rep')}
          >
            ✅ Con REP Timbrado ({repList.length - totalPendientesRep})
          </button>
        </div>

        <div style={{ minWidth: 240 }}>
          <input
            type="text"
            className="input boxed"
            style={{ padding: '6px 12px', fontSize: 13, width: '100%' }}
            placeholder="🔍 Buscar por Factura, CR u OC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Facturas y Complementos REP */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 16,
          padding: '16px',
        }}
      >
        <div className="table-scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Contrarecibo</th>
                <th>OC / Expediente</th>
                <th>Fecha Pago</th>
                <th className="num">Monto Liquidado</th>
                <th style={{ textAlign: 'center' }}>Estatus REP (SAT)</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-soft)' }}>
                    No se encontraron facturas en este filtro.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={`${item.orderId}-${item.invoice.id || item.invoice.folio}`}>
                    <td className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                      #{item.invoice.folio || 'S/F'}
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {item.contrarecibo || '—'}
                    </td>
                    <td className="mono" style={{ color: 'var(--ink-soft)' }}>
                      {item.orderFolio}
                    </td>
                    <td>{fmtDate(item.paidDate)}</td>
                    <td className="num mono" style={{ fontWeight: 800, color: '#059669' }}>
                      {money(item.paidAmount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.hasRep ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                          }}
                          title={item.repUuid}
                        >
                          ✅ Timbrado
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                          }}
                        >
                          ⚠️ Sin REP
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            background: '#25D366',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const msg = generateComplementoPagoContadorMessage({
                              folioFactura: item.invoice.folio || 'S/F',
                              contrarecibo: item.contrarecibo,
                              cliente: item.client,
                              montoPagado: item.paidAmount,
                              fechaPago: item.paidDate,
                              oc: item.orderFolio,
                            });
                            openWhatsAppMessage(msg);
                          }}
                          title="Enviar solicitud estructurada de REP a los contadores"
                        >
                          📲 Pedir REP
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => {
                            setEditingItem(item);
                            setRepUuidInput(item.repUuid || '');
                          }}
                        >
                          {item.hasRep ? '✏️ UUID' : '➕ Registrar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Registrar UUID de REP */}
      {editingItem && (
        <Modal
          title={`📄 Registrar Complemento de Pago (REP) — Factura #${editingItem.invoice.folio || 'S/F'}`}
          onClose={() => setEditingItem(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
              Ingresa el UUID fiscal timbrado por el SAT enviado por los contadores para amparar el pago de <strong>{money(editingItem.paidAmount)}</strong>.
            </p>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                UUID Fiscal del Complemento REP (Folio Fiscal SAT):
              </label>
              <input
                type="text"
                className="input boxed mono"
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 4 }}
                placeholder="Ej. 4A8B62F1-92D0-4E38-994A-22B58DF89231"
                value={repUuidInput}
                onChange={(e) => setRepUuidInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditingItem(null)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#059669', color: '#fff', fontWeight: 800 }}
                onClick={handleSaveRep}
                disabled={saving || !repUuidInput.trim()}
              >
                {saving ? 'Guardando...' : '💾 Guardar REP'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
