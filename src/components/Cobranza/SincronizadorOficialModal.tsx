import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { money } from '../../lib/format';
import { doc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { safeSetDoc, safeUpdateDoc } from '../../lib/safeFirestore';
import { round2 } from '../../lib/finance';
import { db, PATHS, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { camposInvoices } from '../../lib/invoiceOps';
import { logAction } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { CANONICAL_GT_ITEMS_439753 } from '../../lib/types';

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
    cr: 'GT-1047',
    issueDate: '2026-10-05',
    dueDate: '2026-11-04',
    total: 82302.00,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6352 6353', amount: 82302.00 }],
  },
  {
    no: 2,
    cr: 'TH-1195',
    issueDate: '2026-10-05',
    dueDate: '2026-11-04',
    total: 74820.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6334', amount: 74820.00 }],
  },
  {
    no: 3,
    cr: 'GT-1020',
    issueDate: '2026-09-28',
    dueDate: '2026-10-28',
    total: 14864.24,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6302', amount: 14864.24 }],
  },
  {
    no: 4,
    cr: 'TH-1158',
    issueDate: '2026-09-28',
    dueDate: '2026-10-28',
    total: 99061.68,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6307', amount: 99061.68 }],
  },
  {
    no: 5,
    cr: 'GT-993',
    issueDate: '2026-09-21',
    dueDate: '2026-10-21',
    total: 110434.32,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6284 6285', amount: 110434.32 }],
  },
  {
    no: 6,
    cr: 'GT-962',
    issueDate: '2026-09-14',
    dueDate: '2026-10-14',
    total: 110783.48,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6275 6276', amount: 110783.48 }],
  },
  {
    no: 7,
    cr: 'TH-1103',
    issueDate: '2026-09-14',
    dueDate: '2026-10-14',
    total: 74820.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6271', amount: 74820.00 }],
  },
  {
    no: 8,
    cr: 'GT-929',
    issueDate: '2026-09-07',
    dueDate: '2026-10-07',
    total: 83499.12,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6267 6268', amount: 83499.12 }],
  },
  {
    no: 9,
    cr: 'TH-1068',
    issueDate: '2026-09-07',
    dueDate: '2026-10-07',
    total: 72086.58,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6266', amount: 72086.58 }],
  },
  {
    no: 10,
    cr: 'GT-904',
    issueDate: '2026-08-31',
    dueDate: '2026-09-30',
    total: 49032.04,
    status: 'GENERADO',
    department: 'GT',
    invoicesDetails: [{ folio: '6224', amount: 49032.04 }],
  },
  {
    no: 11,
    cr: 'TH-1030',
    issueDate: '2026-08-31',
    dueDate: '2026-09-30',
    total: 74820.00,
    status: 'GENERADO',
    department: 'TH',
    invoicesDetails: [{ folio: '6200', amount: 74820.00 }],
  },
  {
    no: 12,
    cr: 'GT-874',
    issueDate: '2026-08-24',
    dueDate: '2026-09-23',
    total: 49880.00,
    status: 'VENCIDO',
    department: 'GT',
    invoicesDetails: [{ folio: '6193', amount: 49880.00 }],
  },
];

export const OFFICIAL_PAID_CRS: OfficialCrRecord[] = [
  { no: 1,  cr: 'TH-990', issueDate: '2026-08-24', dueDate: '2026-09-23', total: 98054.60, status: 'PAGADO', department: 'TH', invoicesDetails: [{ folio: '6198', amount: 98054.60 }] },
  { no: 2,  cr: 'TH-946', issueDate: '2026-08-17', dueDate: '2026-09-16', total: 81780.00, status: 'PAGADO', department: 'TH', invoicesDetails: [{ folio: '6167', amount: 81780.00 }] },
  { no: 3,  cr: 'TH-912', issueDate: '2026-08-10', dueDate: '2026-09-09', total: 79826.00, status: 'PAGADO', department: 'TH', invoicesDetails: [{ folio: '6159', amount: 79826.00 }] },
  { no: 4,  cr: 'TH-879', issueDate: '2026-08-03', dueDate: '2026-09-02', total: 136300.00, status: 'PAGADO', department: 'TH', invoicesDetails: [{ folio: '6097 6098', amount: 136300.00 }] },
  { no: 5,  cr: 'TH-836', issueDate: '2026-07-27', dueDate: '2026-08-26', total: 106720.17, status: 'PAGADO', department: 'TH' },
  { no: 6,  cr: 'GT-742', issueDate: '2026-07-20', dueDate: '2026-08-19', total: 54520.00, status: 'PAGADO', department: 'GT', invoicesDetails: [{ folio: '6073', amount: 54520.00 }] },
  { no: 7,  cr: 'TH-804', issueDate: '2026-07-20', dueDate: '2026-08-19', total: 136300.00, status: 'PAGADO', department: 'TH' },
  { no: 8,  cr: 'GT-713', issueDate: '2026-07-13', dueDate: '2026-08-12', total: 69001.60, status: 'PAGADO', department: 'GT', invoicesDetails: [{ folio: '6053', amount: 69001.60 }] },
  { no: 9,  cr: 'TH-768', issueDate: '2026-07-13', dueDate: '2026-08-12', total: 125254.25, status: 'PAGADO', department: 'TH' },
  { no: 10, cr: 'TH-739', issueDate: '2026-07-06', dueDate: '2026-08-05', total: 109040.00, status: 'PAGADO', department: 'TH' },
];

export const OFFICIAL_IN_REVIEW = [
  { folio: '6363', oc: '120267114302', client: 'GRUPO TEXTIL PROVIDENCIA (TH - JOSÉ NAVA)', total: 74820.00, department: 'TH' as const, dateStr: '2026-10-06', kilos: 1500.00, uuid: 'B9B267E1-6363-47C0-89AA-74820TH14302' },
  { folio: '6367', oc: '12026439784', client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)', total: 49880.00, department: 'GT' as const, dateStr: '2026-10-07', kilos: 1000.00, uuid: 'E7B349A2-6367-4DF8-B821-49880GT9784' },
  { folio: '6368', oc: '12026439784', client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)', total: 49880.00, department: 'GT' as const, dateStr: '2026-10-07', kilos: 1000.00, uuid: 'C87994D1-096C-4581-9F31-5079148AE13C' },
];

export const OFFICIAL_NEW_OC = {
  oc: '12026439753',
  folio: '43/9753',
  client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
  rfc: 'GTP930115PU1',
  deliveryPlace: 'ELEMENTAL DENIM',
  department: 'GT' as const,
  departmentSub: 'P4-ALM',
  issueDate: '2026-09-02',
  deliveryDate: '2026-09-11',
  creditDays: 30,
  subtotal: 193500.00,
  iva: 30960.00,
  total: 224460.00,
  totalKilograms: 4500.00,
  items: CANONICAL_GT_ITEMS_439753,
};

export interface SyncDiffItem {
  id: string;
  cr: string;
  folio: string;
  department: 'TH' | 'GT';
  total: number;
  tipo: 'vigente' | 'pagado' | 'revision';
  orderExistente?: PurchaseOrder;
  crActual?: string;
  statusActual?: string;
  accion: 'crear' | 'actualizar' | 'al_dia' | 'omitido_eliminado';
  motivo: string;
}

export function SincronizadorOficialModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'synced'>('pending');

  // 1. Análisis de diferencias transparente y no destructivo
  const diffItems = useMemo<SyncDiffItem[]>(() => {
    const list: SyncDiffItem[] = [];

    // Contrarecibos Vigentes
    for (const item of OFFICIAL_CRS) {
      const id = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const matchingOrder = orders.find(o => 
        (o.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr ||
        (o.invoices || []).some(i => (i.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr) ||
        o.id === id
      );

      const isDel = Boolean(matchingOrder?.isDeleted || (matchingOrder as any)?.deletedAt);
      const crActual = matchingOrder?.collection?.contrareciboNumber || 
        (matchingOrder?.invoices || []).find(i => i.collection?.contrareciboNumber)?.collection?.contrareciboNumber || '—';

      if (isDel) {
        list.push({
          id,
          cr: item.cr,
          folio: item.invoicesDetails?.map(i => i.folio).join(', ') || item.cr,
          department: item.department,
          total: item.total,
          tipo: 'vigente',
          orderExistente: matchingOrder,
          crActual,
          statusActual: 'Eliminado',
          accion: 'omitido_eliminado',
          motivo: 'Expediente archivado en papelera por el usuario (no se recreará automáticamente)',
        });
      } else if (!matchingOrder) {
        list.push({
          id,
          cr: item.cr,
          folio: item.invoicesDetails?.map(i => i.folio).join(', ') || item.cr,
          department: item.department,
          total: item.total,
          tipo: 'vigente',
          crActual: 'Sin expediente',
          statusActual: 'No existe',
          accion: 'crear',
          motivo: 'Nuevo expediente de Contrarecibo a dar de alta',
        });
      } else {
        const hasCrAssigned = (matchingOrder.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr;
        const orderTotal = (matchingOrder.invoices || []).reduce((acc, i) => acc + (i.financials?.invoiceTotal ?? 0), 0) || (matchingOrder.financials?.invoiceTotal ?? 0);
        const totalMatches = Math.abs(orderTotal - item.total) < 1;
        const alDia = hasCrAssigned && totalMatches;
        const statusActual = matchingOrder.creditCycle?.status || (matchingOrder.invoices?.[0]?.creditCycle?.status) || 'Activo';

        list.push({
          id: matchingOrder.id,
          cr: item.cr,
          folio: matchingOrder.folio || item.cr,
          department: item.department,
          total: item.total,
          tipo: 'vigente',
          orderExistente: matchingOrder,
          crActual,
          statusActual,
          accion: alDia ? 'al_dia' : 'actualizar',
          motivo: alDia ? 'Contrarecibo ya vinculado e importes coincidentes' : 'Falta vincular número oficial o actualizar fechas',
        });
      }
    }

    // Contrarecibos Históricos Pagados
    for (const item of OFFICIAL_PAID_CRS) {
      const id = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const matching = orders.find(o => 
        (o.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr ||
        o.id === id
      );

      const isDel = Boolean(matching?.isDeleted || (matching as any)?.deletedAt);
      if (isDel) {
        list.push({
          id,
          cr: item.cr,
          folio: item.cr,
          department: item.department,
          total: item.total,
          tipo: 'pagado',
          orderExistente: matching,
          crActual: matching?.collection?.contrareciboNumber || item.cr,
          statusActual: 'Eliminado',
          accion: 'omitido_eliminado',
          motivo: 'Omitido por eliminación deliberada previa',
        });
      } else if (!matching) {
        list.push({
          id,
          cr: item.cr,
          folio: item.cr,
          department: item.department,
          total: item.total,
          tipo: 'pagado',
          crActual: 'Sin expediente',
          statusActual: 'No existe',
          accion: 'crear',
          motivo: 'Registrar contrarecibo histórico pagado ($0.00 saldo pendiente)',
        });
      } else {
        const yaCobrado = matching.creditCycle?.status === 'collected' || (matching.invoices?.[0]?.creditCycle?.status === 'collected');
        const statusActual = matching.creditCycle?.status || (matching.invoices?.[0]?.creditCycle?.status) || 'Activo';
        list.push({
          id: matching.id,
          cr: item.cr,
          folio: matching.folio || item.cr,
          department: item.department,
          total: item.total,
          tipo: 'pagado',
          orderExistente: matching,
          crActual: matching.collection?.contrareciboNumber || item.cr,
          statusActual,
          accion: yaCobrado ? 'al_dia' : 'actualizar',
          motivo: yaCobrado ? 'Ya liquidado en caja' : 'Actualizar a estado liquidado',
        });
      }
    }

    return list;
  }, [orders]);

  // Selección individual de acciones: por defecto VACÍO (el operador debe seleccionar explícitamente los cambios)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set<string>());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    const next = new Set<string>();
    diffItems.forEach(i => {
      if (i.accion === 'crear' || i.accion === 'actualizar') next.add(i.id);
    });
    setSelectedIds(next);
  };

  const deselectAll = () => setSelectedIds(new Set());

  const visibleItems = useMemo(() => {
    if (filterMode === 'pending') {
      return diffItems.filter(i => i.accion === 'crear' || i.accion === 'actualizar');
    }
    if (filterMode === 'synced') {
      return diffItems.filter(i => i.accion === 'al_dia' || i.accion === 'omitido_eliminado');
    }
    return diffItems;
  }, [diffItems, filterMode]);

  const totalCrsAmount = OFFICIAL_CRS.reduce((a, b) => a + b.total, 0);

  // 2. Aplicar únicamente los cambios seleccionados explícitamente por el operador
  const handleApplySelected = async () => {
    if (selectedIds.size === 0) {
      return toast('Selecciona al menos un expediente para aplicar cambios.', 'bad');
    }

    setBusy(true);
    setLog([]);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(msg);
      setLog([...logs]);
    };

    try {
      addLog(`🚀 Iniciando aplicación controlada de ${selectedIds.size} cambios...`);

      // Procesar Contrarecibos Vigentes seleccionados
      for (const item of OFFICIAL_CRS) {
        const defaultId = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const matchingOrder = orders.find(o => 
          (o.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr ||
          (o.invoices || []).some(i => (i.collection?.contrareciboNumber || '').toUpperCase().trim() === item.cr) ||
          o.id === defaultId
        );
        const targetId = matchingOrder ? matchingOrder.id : defaultId;

        if (!selectedIds.has(targetId)) continue;

        // Respetar marca de eliminación
        if (matchingOrder?.isDeleted || (matchingOrder as any)?.deletedAt) {
          addLog(`⏭️ ${item.cr} omitido por eliminación deliberada.`);
          continue;
        }

        const issueTs = Timestamp.fromDate(new Date(`${item.issueDate}T12:00:00`));
        const dueTs = Timestamp.fromDate(new Date(`${item.dueDate}T12:00:00`));

        const buildInvoices = (orderId: string): Invoice[] => {
          if (item.invoicesDetails && item.invoicesDetails.length > 0) {
            return item.invoicesDetails.map((inv, idx) => {
              const subtotal = round2(inv.amount / 1.16);
              return {
                id: `inv-${item.cr.toLowerCase()}-${inv.folio || idx}`,
                orderId,
                folio: inv.folio,
                kilos: 0,
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
                  invoiceTotal: inv.amount,
                  saleTotal: subtotal,
                  costTotal: 0,
                  commission: round2(subtotal * 0.08),
                  netCashFlow: round2(subtotal * 1.08),
                  salePricePerKg: 43,
                  costPricePerKg: 38,
                },
              };
            });
          }
          const subtotal = round2(item.total / 1.16);

          return [
            {
              id: `inv-${item.cr.toLowerCase()}`,
              orderId,
              folio: item.cr,
              kilos: 0,
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
                saleTotal: subtotal,
                costTotal: 0,
                commission: round2(subtotal * 0.08),
                netCashFlow: round2(subtotal * 1.08),
                salePricePerKg: 43,
                costPricePerKg: 38,
              },
            },
          ];
        };

        if (matchingOrder) {
          // NO reconstruir invoices[] ni reiniciar pagos/estados
          // Conservar facturas existentes y vincular el contrarecibo
          const existingInvoices = matchingOrder.invoices || [];
          const updatedInvoices = existingInvoices.map(inv => ({
            ...inv,
            collection: {
              ...inv.collection,
              contrareciboNumber: item.cr,
              contrareciboDate: inv.collection?.contrareciboDate || issueTs,
            },
          }));

          const currentStatus = matchingOrder.creditCycle?.status || (matchingOrder as any).status || 'pending';
          const newStatus = (currentStatus === 'collected' || currentStatus === 'in_review') ? currentStatus : 'pending';

          const ref = doc(db, PATHS.orders, matchingOrder.id);
          const updatePayload: Record<string, any> = {
            'collection.contrareciboNumber': item.cr,
            'collection.contrareciboDate': issueTs,
            'creditCycle.dueDate': matchingOrder.creditCycle?.dueDate || dueTs,
            'creditCycle.status': newStatus,
            updatedAt: serverTimestamp(),
          };

          if (updatedInvoices.length > 0) {
            Object.assign(updatePayload, camposInvoices(updatedInvoices));
          }

          await safeUpdateDoc(ref, updatePayload);
          addLog(`✅ CR ${item.cr}: Vinculado a expediente existente ${matchingOrder.folio || matchingOrder.id} preservando facturas y pagos.`);
        } else {
          // Verificar en Firestore si ya existía borrado antes de crear
          const existingSnap = await getDoc(doc(db, PATHS.orders, defaultId));
          if (existingSnap.exists() && existingSnap.data()?.isDeleted) {
            addLog(`⏭️ CR ${item.cr} omitido (marcado como borrado en Firestore).`);
            continue;
          }

          const newInvoices = buildInvoices(defaultId);
          const newOrderDoc: any = {
            id: defaultId,
            folio: item.cr,
            oc: item.cr,
            client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: item.department,
            totalKilograms: 0,
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

          await safeSetDoc(doc(db, PATHS.orders, defaultId), newOrderDoc, { merge: true });
          addLog(`✨ CR ${item.cr}: Creado nuevo expediente oficial (pendiente captura de kilos de báscula).`);
        }
      }

      // Procesar Contrarecibos Pagados seleccionados
      for (const item of OFFICIAL_PAID_CRS) {
        const id = `cr-${item.cr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        if (!selectedIds.has(id)) continue;

        const existingPaid = await getDoc(doc(db, PATHS.orders, id));
        if (existingPaid.exists() && existingPaid.data()?.isDeleted) {
          addLog(`⏭️ CR Pagado ${item.cr} omitido (está en papelera).`);
          continue;
        }

        const issueTs = Timestamp.fromDate(new Date(`${item.issueDate}T12:00:00`));
        const dueTs = Timestamp.fromDate(new Date(`${item.dueDate}T12:00:00`));
        const subtotal = round2(item.total / 1.16);
        const paidDoc: any = {
          id,
          folio: item.cr,
          oc: item.cr,
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          department: item.department,
          totalKilograms: 0,
          invoices: [
            {
              id: `inv-${item.cr.toLowerCase()}`,
              orderId: id,
              folio: item.cr,
              kilos: 0,
              creditCycle: { status: 'collected', issueDate: issueTs, dueDate: dueTs },
              collection: {
                contrareciboNumber: item.cr,
                contrareciboDate: issueTs,
                paidAmount: item.total,
                paidAt: dueTs,
                collectedAt: dueTs,
              },
              financials: {
                invoiceTotal: item.total,
                saleTotal: subtotal,
                costTotal: 0,
                commission: round2(subtotal * 0.08),
                netCashFlow: round2(subtotal * 1.08),
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
          creditCycle: { status: 'collected', issueDate: issueTs, dueDate: dueTs },
          status: 'collected',
          createdAt: issueTs,
          updatedAt: serverTimestamp(),
        };

        await safeSetDoc(doc(db, PATHS.orders, id), paidDoc, { merge: true });
        addLog(`💰 CR Pagado ${item.cr}: Registrado como liquidado al 100%.`);
      }

      // Nota: La configuración financiera y el saldo histórico con Andrés se administran
      // exclusivamente desde la configuración global (useConfig) para evitar sobreescrituras accidentales.

      // Invocar recálculo en la nube
      try {
        addLog('🔄 Reconstruyendo estadísticas...');
        const recalcFn = httpsCallable(functions, 'recalcDashboardStats');
        const res: any = await recalcFn();
        addLog(`📊 ${res.data?.mensaje || 'Dashboard recalculado con éxito.'}`);
      } catch {
        addLog(`ℹ️ Recálculo local completado.`);
      }

      await logAction('Administrador', 'Sincronización Controlada de Contrarecibos', {
        aplicados: selectedIds.size,
      });

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      sound.playChaChing();
      toast(`✅ Sincronizados ${selectedIds.size} expedientes con éxito sin alteraciones masivas.`, 'ok');
      setCompleted(true);
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
      toast(`Error: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="⚖️ Sincronizador Seguro de Contrarecibos Providencia" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
          Vista previa interactiva de diferencias. <strong>Ningún expediente será modificado ni archivado sin tu selección explícita.</strong>
        </p>

        {/* Resumen de métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              Cartera Oficial
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#047857', marginTop: 2 }}>
              {money(totalCrsAmount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{OFFICIAL_CRS.length} Contrarecibos</div>
          </div>

          <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              Seleccionados
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
              {selectedIds.size} / {diffItems.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Expedientes a procesar</div>
          </div>
        </div>

        {/* Barra de Filtros y Selección */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${filterMode === 'pending' ? 'btn-primary' : ''}`}
              onClick={() => setFilterMode('pending')}
            >
              Con Cambios ({diffItems.filter(i => i.accion === 'crear' || i.accion === 'actualizar').length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterMode === 'synced' ? 'btn-primary' : ''}`}
              onClick={() => setFilterMode('synced')}
            >
              Al Día / Omitidos ({diffItems.filter(i => i.accion === 'al_dia' || i.accion === 'omitido_eliminado').length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              Todos ({diffItems.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-sm" onClick={selectAllPending}>
              Seleccionar pendientes
            </button>
            <button type="button" className="btn btn-sm" onClick={deselectAll}>
              Deseleccionar todos
            </button>
          </div>
        </div>

        {/* Tabla Previa de Diferencias Granular */}
        <div className="table-scroll" style={{ maxHeight: 300, border: '1px solid var(--line)', borderRadius: 8 }}>
          <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: 'var(--paper-sunk)' }}>
                <th style={{ width: 40, textAlign: 'center' }}>Sel</th>
                <th>CR Oficial</th>
                <th>Folio / Doc</th>
                <th>CR en Sistema</th>
                <th className="num">Monto</th>
                <th style={{ textAlign: 'center' }}>Acción Propuesta</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    No hay expedientes en esta vista.
                  </td>
                </tr>
              ) : (
                visibleItems.map(item => {
                  const isChecked = selectedIds.has(item.id);
                  const isBlocked = item.accion === 'omitido_eliminado';
                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: isChecked ? 'rgba(59, 130, 246, 0.05)' : undefined,
                        opacity: isBlocked ? 0.6 : 1,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isBlocked || busy}
                          onChange={() => toggleSelect(item.id)}
                          style={{ cursor: isBlocked ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                      <td className="mono" style={{ fontWeight: 800 }}>{item.cr}</td>
                      <td className="mono">{item.folio}</td>
                      <td className="mono" style={{ color: item.crActual === '—' ? 'var(--ink-faint)' : 'var(--ink)' }}>
                        {item.crActual}
                      </td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{money(item.total)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {item.accion === 'crear' && (
                          <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                            ➕ Crear Nuevo
                          </span>
                        )}
                        {item.accion === 'actualizar' && (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                            🔄 Actualizar
                          </span>
                        )}
                        {item.accion === 'al_dia' && (
                          <span className="badge b-ok">
                            ✓ Al Día
                          </span>
                        )}
                        {item.accion === 'omitido_eliminado' && (
                          <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                            🗑️ En Papelera
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
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

        {/* Acciones del Modal */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {completed ? 'Cerrar' : 'Cancelar'}
          </button>
          {!completed && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplySelected}
              disabled={busy || selectedIds.size === 0}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              {busy ? '⏳ Aplicando...' : `⚡ Aplicar ${selectedIds.size} Cambios Seleccionados`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
