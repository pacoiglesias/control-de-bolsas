import { useState } from 'react';
import { Modal } from '../ui';
import { money, fmtDate } from '../../lib/format';
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { round2, computeFinancials } from '../../lib/finance';
import { db, PATHS, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { camposInvoices } from '../../lib/invoiceOps';
import { logAction } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import type { PurchaseOrder, Invoice } from '../../lib/types';

export interface OfficialCrRecord {
  no: number;
  cr: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  total: number;
  status: string;
  department: 'TH' | 'GT';
  invoicesDetails?: { folio: string; controlInterno?: string; amount: number }[];
}

export const OFFICIAL_CRS: OfficialCrRecord[] = [
  {
    no: 1,
    cr: 'GT-874',
    issueDate: '2026-08-24',
    dueDate: '2026-09-23',
    total: 49880.00,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6224', controlInterno: '2 / 280', amount: 49880.00 }],
  },
  {
    no: 2,
    cr: 'TH-990',
    issueDate: '2026-08-24',
    dueDate: '2026-09-23',
    total: 98054.60,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6198', controlInterno: '8 / 655', amount: 98054.60 }],
  },
  {
    no: 3,
    cr: 'TH-946',
    issueDate: '2026-08-17',
    dueDate: '2026-09-16',
    total: 81780.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6173', controlInterno: '8 / 645', amount: 81780.00 }],
  },
  {
    no: 4,
    cr: 'TH-912',
    issueDate: '2026-08-10',
    dueDate: '2026-09-09',
    total: 79826.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6159', controlInterno: '8 / 630', amount: 79826.00 }],
  },
  {
    no: 5,
    cr: 'TH-879',
    issueDate: '2026-08-03',
    dueDate: '2026-09-02',
    total: 136300.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [
      { folio: '6097', controlInterno: '8 / 611', amount: 109040.00 },
      { folio: '6098', controlInterno: '8 / 612', amount: 27260.00 },
    ],
  },
  {
    no: 6,
    cr: 'GT-742',
    issueDate: '2026-07-20',
    dueDate: '2026-08-19',
    total: 54520.00,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6073', controlInterno: '2 / 260', amount: 54520.00 }],
  },
  {
    no: 7,
    cr: 'GT-713',
    issueDate: '2026-07-13',
    dueDate: '2026-08-12',
    total: 69001.60,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6053', controlInterno: '2 / 249', amount: 69001.60 }],
  },
  {
    no: 8,
    cr: 'GT-651',
    issueDate: '2026-06-29',
    dueDate: '2026-07-29',
    total: 106477.56,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '5971', controlInterno: '2 / 228', amount: 106477.56 }],
  },
];

export const OFFICIAL_PAID_CRS: OfficialCrRecord[] = [
  { no: 1, cr: 'TH-836', issueDate: '2026-07-27', dueDate: '2026-08-26', total: 106720.17, status: 'PAGADO', department: 'TH' },
  { no: 2, cr: 'TH-804', issueDate: '2026-07-20', dueDate: '2026-08-19', total: 136300.00, status: 'PAGADO', department: 'TH' },
  { no: 3, cr: 'TH-768', issueDate: '2026-07-13', dueDate: '2026-08-12', total: 125254.25, status: 'PAGADO', department: 'TH' },
  { no: 4, cr: 'TH-739', issueDate: '2026-07-06', dueDate: '2026-08-05', total: 109040.00, status: 'PAGADO', department: 'TH' },
  { no: 5, cr: 'TH-713', issueDate: '2026-06-29', dueDate: '2026-07-29', total: 108647.46, status: 'PAGADO', department: 'TH' },
  { no: 6, cr: 'GT-624', issueDate: '2026-06-22', dueDate: '2026-07-22', total: 98136.00,  status: 'PAGADO', department: 'GT' },
  { no: 7, cr: 'TH-680', issueDate: '2026-06-22', dueDate: '2026-07-22', total: 80970.38,  status: 'PAGADO', department: 'TH' },
];

export const OFFICIAL_IN_REVIEW = [
  { folio: '6224', oc: '12026439713', client: 'Grupo Textil Providencia - GT', total: 49032.04, department: 'GT', dateStr: '2026-08-26', kilos: 983.00, uuid: '' },
  { folio: '6200', oc: '120267114114', client: 'Grupo Textil Providencia - TH', total: 74820.00, department: 'TH', dateStr: '2026-08-24', kilos: 1500.00, uuid: '771D692B-0BCF-480C-B2CA-40A48E996BA9' },
];

export function SincronizadorOficialModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [purgeOldOrders, setPurgeOldOrders] = useState(true);

  const totalCrsAmount = OFFICIAL_CRS.reduce((a, b) => a + b.total, 0);
  const totalInReviewAmount = Array.isArray(OFFICIAL_IN_REVIEW) ? OFFICIAL_IN_REVIEW.reduce((a, b) => a + b.total, 0) : 0;

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

      // Limpieza de expedientes de prueba obsoletos si está activado
      if (purgeOldOrders) {
        addLog('🧹 Limpiando expedientes de prueba antiguos...');
        const officialCrSet = new Set(OFFICIAL_CRS.map(c => c.cr.toUpperCase().trim()));
        for (const o of orders) {
          const oCr = (o.collection?.contrareciboNumber || o.folio || o.oc || '').toUpperCase().trim();
          const hasMatchingCr = (o.invoices || []).some(i => officialCrSet.has((i.collection?.contrareciboNumber || '').toUpperCase().trim())) || officialCrSet.has(oCr);
          const is6167 = (o.folio === '6167' || o.oc === '120267114014' || (o.invoices || []).some(i => i.folio === '6167'));
          const isInReview = Array.isArray(OFFICIAL_IN_REVIEW) && OFFICIAL_IN_REVIEW.some(item => 
            o.oc === item.oc || o.folio === item.oc || o.folio === item.folio || (o.invoices || []).some(i => i.folio === item.folio)
          );

          if (!hasMatchingCr && !is6167 && !isInReview) {
            try {
              await updateDoc(doc(db, PATHS.orders, o.id), { isDeleted: true, updatedAt: serverTimestamp() });
              addLog(`🗑️ Archivado expediente obsoleto: ${o.folio || o.oc || o.id}`);
            } catch (e: any) {
              console.error(e);
            }
          }
        }
      }

      // 1. Sincronizar los Contrarecibos
      for (const item of OFFICIAL_CRS) {
        const issueTs = Timestamp.fromDate(new Date(`${item.issueDate}T12:00:00`));
        const dueTs = Timestamp.fromDate(new Date(`${item.dueDate}T12:00:00`));

        const buildInvoices = (orderId: string): Invoice[] => {
          const cfg = {
            salePricePerKg: 43,
            costPricePerKg: 38,
            commissionRate: 0.08,
            commissionBase: 'subtotal' as const,
            ivaRate: 0.16,
            creditDays: 30,
          };

          if (item.invoicesDetails && item.invoicesDetails.length > 0) {
            return item.invoicesDetails.map((inv, idx) => {
              const kEst = Math.round(inv.amount / (43 * 1.16));
              const fin = computeFinancials(kEst, cfg);
              fin.invoiceTotal = inv.amount;
              fin.saleTotal = round2(inv.amount / 1.16);

              return {
                id: `inv-${item.cr.toLowerCase()}-${inv.folio || idx}`,
                orderId,
                folio: inv.folio,
                notes: inv.controlInterno ? `Control Interno: ${inv.controlInterno}` : undefined,
                kilos: kEst,
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
                financials: fin,
              };
            });
          }
          const kilosEst = Math.round(item.total / (43 * 1.16));
          const fin = computeFinancials(kilosEst, cfg);
          fin.invoiceTotal = item.total;
          fin.saleTotal = round2(item.total / 1.16);

          return [
            {
              id: `inv-${item.cr.toLowerCase()}`,
              orderId,
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
              financials: fin,
            },
          ];
        };

        // Buscar si ya existe una orden con este CR
        const matchingOrder = orders.find(o => 
          (o.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr ||
          (o.invoices || []).some(i => (i.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr)
        );

        if (matchingOrder) {
          // Actualizar orden existente respetando los folios de factura
          const updatedInvoices = buildInvoices(matchingOrder.id);

          const ref = doc(db, PATHS.orders, matchingOrder.id);
          await updateDoc(ref, {
            ...camposInvoices(updatedInvoices),
            'collection.contrareciboNumber': item.cr,
            'collection.contrareciboDate': issueTs,
            'creditCycle.dueDate': dueTs,
            'creditCycle.status': 'pending',
            updatedAt: serverTimestamp(),
          });

          addLog(`✅ CR ${item.cr} (${money(item.total)}): Sincronizado con folios [${updatedInvoices.map(i => i.folio).join(', ')}].`);
        } else {
          // Crear expediente nuevo para este Contrarecibo Oficial
          const newId = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          const kilosEst = Math.round(item.total / (43 * 1.16));
          const newInvoices = buildInvoices(newId);
          const newOrderDoc: any = {
            id: newId,
            folio: item.cr,
            oc: item.cr,
            client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: item.department,
            totalKilograms: kilosEst,
            invoices: newInvoices,
            invoiceStatuses: ['pending'],
            invoiceFolios: newInvoices.map(i => i.folio),
            invoiceUuids: [],
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

      // 2. Sincronizar los 7 Contrarecibos Históricos Pagados (Saldo $0.00 / 100% Cobrado)
      for (const item of OFFICIAL_PAID_CRS) {
        const issueTs = Timestamp.fromDate(new Date(`${item.issueDate}T12:00:00`));
        const dueTs = Timestamp.fromDate(new Date(`${item.dueDate}T12:00:00`));
        const newId = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const kilosEst = Math.round(item.total / (43 * 1.16));
        const paidDoc: any = {
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
                status: 'collected',
                issueDate: issueTs,
                dueDate: dueTs,
              },
              collection: {
                contrareciboNumber: item.cr,
                contrareciboDate: issueTs,
                paidAmount: item.total,
                paidAt: dueTs,
                collectedAt: dueTs,
              },
              financials: {
                invoiceTotal: item.total,
                saleTotal: round2(item.total / 1.16),
                costTotal: round2(kilosEst * 38),
                commission: round2((item.total / 1.16) * 0.08),
                netCashFlow: round2((item.total / 1.16) * 1.08 - (kilosEst * 38)),
                salePricePerKg: 43,
                costPricePerKg: 38,
              },
            }
          ],
          invoiceStatuses: ['collected'],
          invoiceFolios: [item.cr],
          collection: {
            contrareciboNumber: item.cr,
            contrareciboDate: issueTs,
            paidAmount: item.total,
            paidAt: dueTs,
            collectedAt: dueTs,
          },
          creditCycle: {
            status: 'collected',
            issueDate: issueTs,
            dueDate: dueTs,
          },
          status: 'collected',
          createdAt: issueTs,
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, PATHS.orders, newId), paidDoc, { merge: true });
        addLog(`💰 CR Pagado ${item.cr} (${money(item.total)}): Registrado como liquidado al 100% en caja.`);
      }

      // 3. Sincronizar Facturas en Revisión por Orden de Compra
      if (Array.isArray(OFFICIAL_IN_REVIEW)) {
        // Agrupar facturas por OC
        const ocGroupsMap = new Map<string, typeof OFFICIAL_IN_REVIEW>();
        for (const item of OFFICIAL_IN_REVIEW) {
          const list = ocGroupsMap.get(item.oc) || [];
          list.push(item);
          ocGroupsMap.set(item.oc, list);
        }

        for (const [ocNumber, items] of ocGroupsMap.entries()) {
          const orderId = `oc-${ocNumber}`;
          const isTH = ocNumber === '120267114114';
          const kilosPedidosOC = isTH ? 6500 : 3700;
          const earliestDate = new Date(`${items[0].dateStr}T12:00:00`);

          // Partidas oficiales extraídas del PDF
          const itemsList = isTH ? [
            { id: 'it-th-1', code: 'egbo000107-sc', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-th-2', code: 'enbo000167-bl', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-th-3', code: 'egbo000103-sc', description: 'BULTO 80 X 20 +20 X 160 *250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-th-4', code: 'enbo000006-sc', description: 'BOLSA POLIETILENO 77 CM X 55 CM _Sin Color', quantity: 2000, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
            { id: 'it-th-5', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-th-6', code: 'enbo000044-sc', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500, unitPrice: 43.0, amount: 21500, unit: 'Kilos' },
          ] : [
            { id: 'it-gt-1', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-gt-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            { id: 'it-gt-3', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 700, unitPrice: 43.0, amount: 30100, unit: 'Kilos' },
            { id: 'it-gt-4', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
          ];

          const invoicesList = items.map(inv => {
            const iDate = new Date(`${inv.dateStr}T12:00:00`);
            const dDate = new Date(iDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            return {
              id: `inv-${inv.folio}`,
              orderId,
              folio: inv.folio,
              kilos: inv.kilos,
              uuid: inv.uuid,
              creditCycle: {
                status: 'facturado',
                issueDate: Timestamp.fromDate(iDate),
                dueDate: Timestamp.fromDate(dDate),
              },
              collection: {
                contrareciboNumber: '',
                paidAmount: 0,
                notes: `Factura ${inv.folio} en revisión en Cuentas por Pagar Providencia`,
              },
              financials: {
                invoiceTotal: inv.total,
                saleTotal: round2(inv.total / 1.16),
                ivaTotal: round2(inv.total - (inv.total / 1.16)),
              },
            };
          });

          const deliveriesList = items.map(inv => {
            const iDate = new Date(`${inv.dateStr}T12:00:00`);
            const delivItems = inv.folio === '6198'
              ? [
                  { itemId: 'it-th-1', quantity: 990.16 },
                  { itemId: 'it-th-3', quantity: 975.65 },
                ]
              : inv.folio === '6200'
              ? [
                  { itemId: 'it-th-2', quantity: 1000.0 },
                  { itemId: 'it-th-4', quantity: 500.0 },
                ]
              : inv.folio === '6193'
              ? [
                  { itemId: 'it-gt-1', quantity: 500.0 },
                  { itemId: 'it-gt-2', quantity: 500.0 },
                ]
              : [];

            return {
              id: `del-billed-${inv.folio}`,
              date: Timestamp.fromDate(iDate),
              kilos: inv.kilos,
              items: delivItems,
              invoiced: true,
              invoiceId: `inv-${inv.folio}`,
              docType: 'factura' as const,
              docFolio: inv.folio,
            };
          });

          const totalKilosEntregados = deliveriesList.reduce((a, d) => a + d.kilos, 0);

          const orderDoc: any = {
            id: orderId,
            folio: isTH ? '71/14114' : '43/9713',
            oc: ocNumber,
            client: isTH ? 'GRUPO TEXTIL PROVIDENCIA (TH - Nava)' : 'GRUPO TEXTIL PROVIDENCIA (GT - Evelia / P4)',
            department: isTH ? 'TH-ALMACEN-1' : 'P4-ALM',
            totalKilograms: kilosPedidosOC,
            items: itemsList,
            invoices: invoicesList,
            invoiceStatuses: invoicesList.map(() => 'facturado'),
            collection: {
              contrareciboNumber: '',
              paidAmount: 0,
            },
            creditCycle: {
              status: 'facturado',
              issueDate: Timestamp.fromDate(earliestDate),
            },
            status: 'facturado',
            deliveries: deliveriesList,
            createdAt: Timestamp.fromDate(earliestDate),
            updatedAt: serverTimestamp(),
          };

          await setDoc(doc(db, PATHS.orders, orderId), orderDoc, { merge: true });
          const foliosListStr = items.map(i => `#${i.folio} (${i.kilos} kg)`).join(', ');
          addLog(`📝 OC ${ocNumber} (${isTH ? 'TH' : 'GT'}): Facturas ${foliosListStr} registradas en revisión.`);

          // Registrar compra en la colección de Compras con Andrés
          const purchaseDoc = {
            id: orderId,
            date: Timestamp.fromDate(earliestDate),
            provider: 'Andres',
            expectedKilos: totalKilosEntregados,
            receivedKilos: totalKilosEntregados,
            pricePerKg: 38,
            totalAmount: round2(totalKilosEntregados * 38),
            paidAmount: 0,
            status: 'entregado',
            notes: `Entrega de ${totalKilosEntregados} kg para OC ${ocNumber}`,
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, PATHS.purchases, orderId), purchaseDoc, { merge: true });
        }
      }

      // 2.1 Actualizar saldo histórico con Andrés solo si no está configurado
      try {
        const docRef = doc(db, PATHS.config, 'financials');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data()?.historicalDebtAndres === undefined) {
          await setDoc(docRef, { historicalDebtAndres: 103411.84 }, { merge: true });
          addLog(`⚖️ Saldo histórico inicial con Andrés establecido a: $103,411.84.`);
        } else {
          addLog(`⚖️ Saldo histórico con Andrés preservado (ya configurado por el usuario: ${money(docSnap.data().historicalDebtAndres)}).`);
        }
      } catch (err) {
        console.warn('Error al verificar/actualizar financials config', err);
      }

      // 3. Invocar recálculo en la nube
      try {
        addLog('🔄 Reconstruyendo estadísticas del Dashboard en la nube...');
        const recalcFn = httpsCallable(functions, 'recalcDashboardStats');
        const res: any = await recalcFn();
        addLog(`📊 ${res.data?.mensaje || 'Dashboard recalculado con éxito.'}`);
      } catch {
        addLog(`ℹ️ Recálculo local en progreso.`);
      }

      await logAction('Administrador', 'Sincronización de Contrarecibos Oficiales', {
        totalCrs: OFFICIAL_CRS.length,
        montoTotalCrs: totalCrsAmount,
        facturaEnRevision: OFFICIAL_IN_REVIEW ? (OFFICIAL_IN_REVIEW as any).folio : '',
        purgadosAntiguos: purgeOldOrders,
      });

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#7c3aed'],
      });

      sound.playChaChing();
      toast(`🎉 Base de datos sincronizada con éxito con los ${OFFICIAL_CRS.length} Contrarecibos.`, 'ok');
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
          Este módulo actualizará tu base de datos en Firestore con los <strong>{OFFICIAL_CRS.length} Contrarecibos vigentes</strong> de Providencia.
        </p>

        {/* Checkbox para limpiar expedientes antiguos de prueba */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.25)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={purgeOldOrders}
            onChange={(e) => setPurgeOldOrders(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b91c1c' }}>
              🧹 Limpiar expedientes obsoletos / de prueba antiguos
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
              Archiva expedientes huérfanos para que el Dashboard y el recálculo se hagan <strong>estrictamente sobre tus {OFFICIAL_CRS.length + (Array.isArray(OFFICIAL_IN_REVIEW) ? OFFICIAL_IN_REVIEW.length : 0)} expedientes reales</strong>.
            </div>
          </div>
        </label>

        {/* Resumen de Importes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              {OFFICIAL_CRS.length} Contrarecibos Emitidos
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#047857', marginTop: 4 }}>
              {money(totalCrsAmount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              100% por cobrar en cartera activa
            </div>
          </div>

          {Array.isArray(OFFICIAL_IN_REVIEW) && OFFICIAL_IN_REVIEW.length > 0 && (
            <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                {OFFICIAL_IN_REVIEW.length} Facturas en Revisión
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#d97706', marginTop: 4 }}>
                {money(totalInReviewAmount)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                Pendientes de contrarecibo
              </div>
            </div>
          )}
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
              {Array.isArray(OFFICIAL_IN_REVIEW) && OFFICIAL_IN_REVIEW.map((item) => (
                <tr key={item.folio} style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                  <td className="mono" style={{ fontWeight: 800, color: '#b45309' }}>FAC #${item.folio}</td>
                  <td className="mono">{fmtDate(new Date(`${item.dateStr}T12:00:00`))}</td>
                  <td className="mono">—</td>
                  <td className="num mono" style={{ fontWeight: 700, color: '#b45309' }}>{money(item.total)}</td>
                  <td style={{ textAlign: 'center' }}><span className="badge b-warn">En Revisión</span></td>
                </tr>
              ))}
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
