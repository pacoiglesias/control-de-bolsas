import { useState } from 'react';
import { Modal } from '../ui';
import { money, fmtDate } from '../../lib/format';
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices } from '../../lib/invoiceOps';
import { logAction } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import type { PurchaseOrder } from '../../lib/types';

export interface OfficialCrRecord {
  no: number;
  cr: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  total: number;
  status: string;
  department: 'TH' | 'GT';
}

export const OFFICIAL_CRS: OfficialCrRecord[] = [
  { no: 1, cr: 'TH-912', issueDate: '2026-08-10', dueDate: '2026-09-09', total: 79826.00, status: 'GENERADO', department: 'TH' },
  { no: 2, cr: 'TH-879', issueDate: '2026-08-03', dueDate: '2026-09-02', total: 136300.00, status: 'GENERADO', department: 'TH' },
  { no: 3, cr: 'TH-836', issueDate: '2026-07-27', dueDate: '2026-08-26', total: 106720.17, status: 'GENERADO', department: 'TH' },
  { no: 4, cr: 'GT-742', issueDate: '2026-07-20', dueDate: '2026-08-19', total: 54520.00, status: 'GENERADO', department: 'GT' },
  { no: 5, cr: 'TH-804', issueDate: '2026-07-20', dueDate: '2026-08-19', total: 136300.00, status: 'GENERADO', department: 'TH' },
  { no: 6, cr: 'GT-713', issueDate: '2026-07-13', dueDate: '2026-08-12', total: 69001.60, status: 'GENERADO', department: 'GT' },
  { no: 7, cr: 'TH-768', issueDate: '2026-07-13', dueDate: '2026-08-12', total: 125254.25, status: 'GENERADO', department: 'TH' },
  { no: 8, cr: 'GT-651', issueDate: '2026-06-29', dueDate: '2026-07-29', total: 106477.56, status: 'GENERADO', department: 'GT' },
  { no: 9, cr: 'GT-624', issueDate: '2026-06-22', dueDate: '2026-07-22', total: 98136.00, status: 'GENERADO', department: 'GT' },
  { no: 10, cr: 'GT-597', issueDate: '2026-06-15', dueDate: '2026-07-15', total: 107420.76, status: 'GENERADO', department: 'GT' },
];

export const OFFICIAL_IN_REVIEW = {
  rfc: 'GTP930115PU1',
  client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
  oc: '120267114014',
  folio: '6167',
  issueDate: '2026-08-10',
  total: 81780.00,
  statusText: 'En Revisión (Pendiente de Contrarecibo)',
};

export function SincronizadorOficialModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  const totalCrsAmount = OFFICIAL_CRS.reduce((a, b) => a + b.total, 0);

  const handleSyncAll = async () => {
    setBusy(true);
    setLog([]);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(msg);
      setLog([...logs]);
    };

    try {
      addLog('🚀 Iniciando sincronización oficial de Contrarecibos...');

      // 1. Sincronizar los 10 Contrarecibos
      for (const item of OFFICIAL_CRS) {
        const issueTs = Timestamp.fromDate(new Date(`${item.issueDate}T12:00:00`));
        const dueTs = Timestamp.fromDate(new Date(`${item.dueDate}T12:00:00`));

        // Buscar si ya existe una orden con este CR o monto aproximado
        let matchingOrder = orders.find(o => 
          (o.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr ||
          (o.invoices || []).some(i => (i.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr)
        );

        if (matchingOrder) {
          // Actualizar orden existente
          const updatedInvoices: any[] = (matchingOrder.invoices && matchingOrder.invoices.length > 0)
            ? matchingOrder.invoices.map(inv => ({
                ...inv,
                creditCycle: {
                  ...inv.creditCycle,
                  issueDate: issueTs,
                  dueDate: dueTs,
                  status: 'pending',
                },
                collection: {
                  ...inv.collection,
                  contrareciboNumber: item.cr,
                  contrareciboDate: issueTs,
                },
                financials: {
                  ...inv.financials,
                  invoiceTotal: item.total,
                }
              }))
            : [{
                id: `inv-${item.cr.toLowerCase()}`,
                orderId: matchingOrder.id,
                folio: matchingOrder.folio || item.cr,
                kilos: Math.round(item.total / (43 * 1.16)),
                creditCycle: {
                  status: 'pending',
                  issueDate: issueTs,
                  dueDate: dueTs,
                },
                collection: {
                  contrareciboNumber: item.cr,
                  contrareciboDate: issueTs,
                  paidAmount: 0,
                },
                financials: {
                  invoiceTotal: item.total,
                } as any,
              }];

          const ref = doc(db, PATHS.orders, matchingOrder.id);
          await updateDoc(ref, {
            ...camposInvoices(updatedInvoices),
            'collection.contrareciboNumber': item.cr,
            'collection.contrareciboDate': issueTs,
            'creditCycle.dueDate': dueTs,
            'creditCycle.status': 'pending',
            updatedAt: serverTimestamp(),
          });

          addLog(`✅ CR ${item.cr} (${money(item.total)}): Actualizado en orden existente (${matchingOrder.folio || matchingOrder.id}).`);
        } else {
          // Crear expediente nuevo para este Contrarecibo Oficial
          const newId = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          const kilosEst = Math.round(item.total / (43 * 1.16));
          const newOrderDoc: any = {
            id: newId,
            folio: item.cr,
            oc: item.cr,
            client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: item.department,
            totalKilograms: kilosEst,
            invoices: [
              {
                id: `inv-${item.cr.toLowerCase()}`,
                orderId: newId,
                folio: item.cr,
                kilos: kilosEst,
                creditCycle: {
                  status: 'pending',
                  issueDate: issueTs,
                  dueDate: dueTs,
                },
                collection: {
                  contrareciboNumber: item.cr,
                  contrareciboDate: issueTs,
                  paidAmount: 0,
                },
                financials: {
                  invoiceTotal: item.total,
                  saleTotal: item.total / 1.16,
                  ivaTotal: item.total - (item.total / 1.16),
                },
              }
            ],
            invoiceStatuses: ['pending'],
            collection: {
              contrareciboNumber: item.cr,
              contrareciboDate: issueTs,
              paidAmount: 0,
            },
            creditCycle: {
              status: 'pending',
              issueDate: issueTs,
              dueDate: dueTs,
            },
            status: 'pending',
            createdAt: issueTs,
            updatedAt: serverTimestamp(),
          };

          await setDoc(doc(db, PATHS.orders, newId), newOrderDoc, { merge: true });
          addLog(`✨ CR ${item.cr} (${money(item.total)}): Creado nuevo expediente oficial en Firestore.`);
        }
      }

      // 2. Sincronizar Factura 6167 en Revisión (OC 120267114014)
      const oc6167Id = 'oc-120267114014';
      const issue6167Ts = Timestamp.fromDate(new Date('2026-08-10T10:48:40'));
      const kilos6167 = Math.round(OFFICIAL_IN_REVIEW.total / (43 * 1.16));

      const order6167Doc: any = {
        id: oc6167Id,
        folio: OFFICIAL_IN_REVIEW.folio,
        oc: OFFICIAL_IN_REVIEW.oc,
        client: OFFICIAL_IN_REVIEW.client,
        totalKilograms: kilos6167,
        invoices: [
          {
            id: `inv-${OFFICIAL_IN_REVIEW.folio}`,
            orderId: oc6167Id,
            folio: OFFICIAL_IN_REVIEW.folio,
            kilos: kilos6167,
            creditCycle: {
              status: 'facturado',
              issueDate: issue6167Ts,
              dueDate: Timestamp.fromDate(new Date('2026-09-09T10:48:40')),
            },
            collection: {
              contrareciboNumber: '', // Sin CR, en revisión
              paidAmount: 0,
              notes: 'Factura 6167 en revisión en Cuentas por Pagar Providencia',
            },
            financials: {
              invoiceTotal: OFFICIAL_IN_REVIEW.total,
              saleTotal: OFFICIAL_IN_REVIEW.total / 1.16,
              ivaTotal: OFFICIAL_IN_REVIEW.total - (OFFICIAL_IN_REVIEW.total / 1.16),
            },
          }
        ],
        invoiceStatuses: ['facturado'],
        collection: {
          contrareciboNumber: '',
          paidAmount: 0,
        },
        creditCycle: {
          status: 'facturado',
          issueDate: issue6167Ts,
        },
        status: 'facturado',
        createdAt: issue6167Ts,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, PATHS.orders, oc6167Id), order6167Doc, { merge: true });
      addLog(`📝 Factura #${OFFICIAL_IN_REVIEW.folio} (OC ${OFFICIAL_IN_REVIEW.oc}): Registrada como "En Revisión (Pendiente de Contrarecibo)" por ${money(OFFICIAL_IN_REVIEW.total)}.`);

      await logAction('Administrador', 'Sincronización de Contrarecibos Oficiales', {
        totalCrs: OFFICIAL_CRS.length,
        montoTotalCrs: totalCrsAmount,
        facturaEnRevision: OFFICIAL_IN_REVIEW.folio,
      });

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#7c3aed'],
      });

      sound.playChaChing();
      toast('🎉 Base de datos sincronizada con éxito con los 10 Contrarecibos y Factura 6167.', 'ok');
      setCompleted(true);
    } catch (e: any) {
      addLog(`❌ Error durante sincronización: ${e.message}`);
      toast(`Error: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="⚡ Sincronizador Oficial de Contrarecibos Providencia" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
          Este módulo actualizará tu base de datos en Firestore con los <strong>10 Contrarecibos vigentes</strong> y la <strong>Factura 6167 en revisión</strong> proporcionados directamente de Providencia.
        </p>

        {/* Resumen de Importes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              10 Contrarecibos Emitidos
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#047857', marginTop: 4 }}>
              {money(totalCrsAmount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              100% por cobrar en cartera activa
            </div>
          </div>

          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              1 Factura en Revisión
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#d97706', marginTop: 4 }}>
              {money(OFFICIAL_IN_REVIEW.total)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Fac #{OFFICIAL_IN_REVIEW.folio} (OC {OFFICIAL_IN_REVIEW.oc})
            </div>
          </div>
        </div>

        {/* Tabla Previa de Datos a Sincronizar */}
        <div className="table-scroll" style={{ maxHeight: 260, border: '1px solid var(--line)', borderRadius: 8 }}>
          <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: 'var(--paper-sunk)' }}>
                <th>CR / Doc</th>
                <th>Emisión</th>
                <th>Vencimiento</th>
                <th className="num">Importe</th>
                <th style={{ textAlign: 'center' }}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {OFFICIAL_CRS.map((c) => (
                <tr key={c.cr}>
                  <td className="mono" style={{ fontWeight: 800 }}>{c.cr}</td>
                  <td className="mono">{fmtDate(new Date(c.issueDate))}</td>
                  <td className="mono">{fmtDate(new Date(c.dueDate))}</td>
                  <td className="num mono" style={{ fontWeight: 700, color: '#047857' }}>{money(c.total)}</td>
                  <td style={{ textAlign: 'center' }}><span className="badge b-ok">{c.status}</span></td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                <td className="mono" style={{ fontWeight: 800, color: '#b45309' }}>FAC #{OFFICIAL_IN_REVIEW.folio}</td>
                <td className="mono">{fmtDate(new Date(OFFICIAL_IN_REVIEW.issueDate))}</td>
                <td className="mono">—</td>
                <td className="num mono" style={{ fontWeight: 700, color: '#b45309' }}>{money(OFFICIAL_IN_REVIEW.total)}</td>
                <td style={{ textAlign: 'center' }}><span className="badge b-warn">En Revisión</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bitácora de Sincronización en Vivo */}
        {log.length > 0 && (
          <div style={{ background: '#0f172a', color: '#38bdf8', padding: 12, borderRadius: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto' }}>
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {completed ? 'Cerrar' : 'Cancelar'}
          </button>
          {!completed && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSyncAll}
              disabled={busy}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              {busy ? '⏳ Sincronizando...' : '⚡ Actualizar Base de Datos en Firestore'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
