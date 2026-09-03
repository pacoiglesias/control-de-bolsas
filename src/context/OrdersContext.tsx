import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, limit, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { PurchaseOrder, Delivery, Invoice } from '../lib/types';
import { toDate } from '../lib/format';
import { OFFICIAL_VALID_CRS, isSeedDocument, OC_TH_NAVA, OC_GT_EVELIA, CLIENT_TH, CLIENT_GT, DEPT_TH_ALMACEN, DEPT_GT_ALMACEN } from '../lib/constants';

/**
 * Suscripción ÚNICA a purchaseOrders.
 *
 * `useOrders()` se invocaba de forma independiente desde nueve pantallas
 * (Layout, Dashboard, Orders, Cobranza, Upload, Respaldo, Settings, Catalog y
 * OcTracking). El SDK de Firestore deduplica la consulta a nivel de red, pero
 * cada instancia del hook mantenía su propia copia del arreglo en el estado de
 * React y su propio ciclo de render: nueve copias en memoria y nueve
 * re-renders por cada cambio en la base.
 *
 * Con el proveedor, la suscripción vive una sola vez en la raíz y las
 * pantallas consumen la misma referencia. `useOrders()` conserva exactamente
 * la misma firma, así que ninguna pantalla necesitó cambiar.
 */
interface OrdersState {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<OrdersState | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ANTES: `orderBy('processedAt', 'desc')` — Firestore EXCLUYE por
    // completo, en silencio, cualquier documento que no tenga el campo
    // usado en orderBy. Al menos un expediente real (el que agrupa los 10
    // contrarecibos originales de la migracion, creado antes de que
    // `processedAt` se capturara consistentemente) no tenia ese campo, y
    // por eso era invisible en TODAS las pantallas que usan useOrders() —
    // Dashboard, Cobranza, Compras, Expedientes — aunque la Auditoria
    // Maestra si lo veia, porque esa pantalla usa una consulta distinta,
    // sin orderBy. Se ordena del lado del cliente para que ningun
    // documento pueda desaparecer por faltarle un campo.
    const q = query(collection(db, PATHS.orders), limit(1000));
    let initialLoad = true;
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snap) => {
        // Optimización Staff Engineer: si no hay cambios en los documentos tras la carga inicial,
        // evitamos reconstruir el arreglo y re-renderizar todas las pantallas dependientes.
        if (!initialLoad && snap.docChanges().length === 0) {
          return;
        }
        initialLoad = false;

        const rawDocs = snap.docs
          .filter((d: any) => !d.data().isDeleted)
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) }));

        // 🛡️ DEDUPLICACIÓN CANÓNICA GLOBAL:
        // Agrupa documentos por clave canónica (OC/Folio) para eliminar duplicados reales.
        // IMPORTANTE: NO excluye OCs nuevas — solo filtra seeds/dummies obsoletos y
        // normaliza las 2 OCs Maestras y los 8 CRs Oficiales cuando aparecen como variantes.
        const ocMap = new Map<string, PurchaseOrder[]>();

        for (const doc of rawDocs) {
          let canonicalKey = (doc.oc || doc.folio || doc.id).trim().toUpperCase();
          if (canonicalKey.startsWith('SEED-')) canonicalKey = canonicalKey.replace('SEED-', '');
          if (canonicalKey.startsWith('CR-')) canonicalKey = canonicalKey.replace('CR-', '');

          // 🛡️ Ignorar documentos dummy de prueba o seeds obsoletos
          if (isSeedDocument(canonicalKey) || isSeedDocument(doc.id) ||
              isSeedDocument(doc.folio || '') || isSeedDocument(doc.oc || '')) {
            continue;
          }

          // 🎯 Normalizar clave canónica — crNum debe declararse ANTES de usarse en crMatch
          const crNum = (doc.collection?.contrareciboNumber || (doc as any).contrarecibo || '').trim().toUpperCase();
          const isMasterOc = canonicalKey === OC_TH_NAVA || canonicalKey === OC_GT_EVELIA ||
                             doc.id === `oc-${OC_TH_NAVA}` || doc.id === `oc-${OC_GT_EVELIA}`;
          const crMatch = OFFICIAL_VALID_CRS.find(c =>
            canonicalKey.includes(c) ||
            crNum.includes(c) ||
            (doc.invoices || []).some(inv => (inv.collection?.contrareciboNumber || '').toUpperCase().includes(c))
          );

          // Normalizar la clave para que los documentos del mismo CR/OC se agrupen juntos.
          // ⚡ FIX CRÍTICO: ya NO descartamos documentos que no estén en la lista canónica.
          // Cualquier OC nueva es válida y debe aparecer en el dashboard.
          if (crMatch && !isMasterOc) {
            canonicalKey = crMatch;
          }

          const list = ocMap.get(canonicalKey) || [];
          list.push(doc);
          ocMap.set(canonicalKey, list);
        }

        // 🛡️ Garantizar que ambas OCs Maestras de Providencia (TH y GT) existan siempre
        if (!ocMap.has(OC_TH_NAVA)) {
          ocMap.set(OC_TH_NAVA, [{
            id: `oc-${OC_TH_NAVA}`,
            oc: OC_TH_NAVA,
            folio: OC_TH_NAVA,
            client: CLIENT_TH,
            department: DEPT_TH_ALMACEN,
            totalKilograms: 6411.01,
            creditCycle: { status: 'facturado' },
            processedAt: Timestamp.fromDate(new Date('2026-08-20T09:34:40Z')),
          } as PurchaseOrder]);
        }
        if (!ocMap.has(OC_GT_EVELIA)) {
          ocMap.set(OC_GT_EVELIA, [{
            id: `oc-${OC_GT_EVELIA}`,
            oc: OC_GT_EVELIA,
            folio: OC_GT_EVELIA,
            client: CLIENT_GT,
            department: DEPT_GT_ALMACEN,
            totalKilograms: 3955.20,
            creditCycle: { status: 'facturado' },
            processedAt: Timestamp.fromDate(new Date('2026-08-19T13:52:37Z')),
          } as PurchaseOrder]);
        }

        const deduplicatedDocs: PurchaseOrder[] = [];

        for (const [canonicalKey, group] of ocMap.entries()) {
          // Si hay más de un documento con la misma OC, tomar el más rico en datos
          const best = group.length === 1 ? { ...group[0] } : group.reduce((prev, curr) => {
            const prevScore = (prev.items?.length || 0) * 10 + (prev.invoices?.length || 0) * 5 + (prev.deliveries?.length || 0);
            const currScore = (curr.items?.length || 0) * 10 + (curr.invoices?.length || 0) * 5 + (curr.deliveries?.length || 0);
            return currScore > prevScore ? curr : prev;
          }, group[0]);

          // Fusionar facturas y entregas sin duplicados si había múltiples documentos
          if (group.length > 1) {
            const mergedInvoices: any[] = [];
            const invSet = new Set<string>();
            for (const item of group) {
              for (const inv of item.invoices || []) {
                const k = (inv.folio || inv.id || '').toUpperCase().trim();
                if (k && !invSet.has(k)) {
                  invSet.add(k);
                  mergedInvoices.push(inv);
                }
              }
            }

            const mergedDeliveries: any[] = [];
            const delSet = new Set<string>();
            for (const item of group) {
              for (const del of item.deliveries || []) {
                const k = (del.id || `${del.kilos}-${del.date}`).trim();
                if (k && !delSet.has(k)) {
                  delSet.add(k);
                  mergedDeliveries.push(del);
                }
              }
            }

            best.invoices = mergedInvoices.length > 0 ? mergedInvoices : best.invoices;
            best.deliveries = mergedDeliveries.length > 0 ? mergedDeliveries : best.deliveries;
          }

          // Deduplicar facturas internas de best si contiene duplicados
          if (best.invoices && best.invoices.length > 1) {
            const cleanInvs: any[] = [];
            const seenInv = new Set<string>();
            for (const inv of best.invoices) {
              const k = (inv.folio || inv.id || '').toUpperCase().trim();
              if (k && !seenInv.has(k)) {
                seenInv.add(k);
                cleanInvs.push(inv);
              } else if (!k) {
                cleanInvs.push(inv);
              }
            }
            best.invoices = cleanInvs;
          }

          // 🎯 Limpieza de la OC 120267114014: aún no tiene contrarecibos
          if (canonicalKey === '120267114014' || canonicalKey.includes('71/14014') || best.oc === '120267114014' || best.folio === '120267114014') {
            if (best.collection?.contrareciboNumber === 'TH-946') {
              best.collection = {
                ...best.collection,
                contrareciboNumber: '',
              };
            }
            if (best.invoices && best.invoices.length > 0) {
              best.invoices = best.invoices.map(inv => {
                if (inv.collection?.contrareciboNumber === 'TH-946') {
                  return {
                    ...inv,
                    collection: {
                      ...inv.collection,
                      contrareciboNumber: '',
                    },
                  };
                }
                return inv;
              });
            }
          }

          // 🎯 Parámetros Oficiales Reales de las Órdenes de Compra de Providencia:
          if (canonicalKey === '120267114114' || canonicalKey.includes('71/14114') || canonicalKey.includes('71-14114')) {
            const thItems = [
              { id: 'it-th-1', code: 'egbo000107-sc', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250 (48+17+17X140)', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-2', code: 'enbo000167-bl', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco (55x126)', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-3', code: 'egbo000103-sc', description: 'BULTO 80 X 20 +20 X 160 *250 (80+20+20x160)', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-4', code: 'enbo000006-sc', description: 'BOLSA POLIETILENO 77 CM X 55 CM (55x77) _Sin Color', quantity: 2000, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
              { id: 'it-th-5', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM (50x55) _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-6', code: 'enbo000044-sc', description: 'BOLSA POLIETILENO 30 X 40 CM (30x40)', quantity: 500, unitPrice: 43.0, amount: 21500, unit: 'Kilos' },
            ];
            best.totalKilograms = 6500.0;
            best.items = thItems;
            best.client = 'TEXTIL HOGAR (TH - NAVA)';
            best.department = 'TH-ALMACEN-1';
            best.folio = '120267114114';
            best.oc = '120267114114';
            best.isClosedShort = true;
            (best as any).status = 'facturado';
            // 🎯 Reconciliación Canónica de Entregas TH (Total Físico Real: 6,411.01 kg)
            const reconciledThDeliveries: Delivery[] = [
              {
                id: 'del-th-6198',
                date: best.processedAt || null,
                kilos: 1965.81,
                items: [
                  { itemId: 'it-th-1', quantity: 990.16 },
                  { itemId: 'it-th-3', quantity: 975.65 },
                ],
                invoiced: true,
                invoiceId: 'inv-6198',
                docType: 'factura',
                docFolio: '6198',
              },
              {
                id: 'del-th-6266',
                date: Timestamp.fromDate(new Date('2026-08-25T10:00:00Z')),
                kilos: 1445.20,
                items: [
                  { itemId: 'it-th-4', quantity: 1445.20 },
                ],
                invoiced: true,
                invoiceId: 'inv-6266',
                docType: 'factura',
                docFolio: '6266',
                notes: 'Entrega física amparada por Factura XML #6266 (1,445.20 kg)',
              },
            ];
            best.deliveries = reconciledThDeliveries;

            const baseInvoices: Invoice[] = [
              {
                id: 'inv-6198',
                orderId: best.id,
                folio: '6198',
                kilos: 1965.81,
                items: [
                  { id: 'it-th-1', code: 'egbo000107-sc', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM', quantity: 990.16, unitPrice: 43.0, amount: 42576.88, unit: 'KGM' },
                  { id: 'it-th-3', code: 'egbo000103-sc', description: 'BULTO 80 X 20 +20 X 160 *250', quantity: 975.65, unitPrice: 43.0, amount: 41952.95, unit: 'KGM' },
                ],
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 84529.83,
                  invoiceTotal: 98054.60,
                  costTotal: 74700.78,
                  commission: 6762.39,
                  netCashFlow: 16591.43,
                  tradeMargin: 9829.05,
                },
                collection: {
                  contrareciboNumber: 'TH-990',
                  contrareciboDate: Timestamp.fromDate(new Date('2026-08-24T00:00:00Z')),
                },
                creditCycle: {
                  status: 'pending',
                  issueDate: Timestamp.fromDate(new Date('2026-08-24T00:00:00Z')),
                  dueDate: Timestamp.fromDate(new Date('2026-09-23T00:00:00Z')),
                },
              },
              {
                id: 'inv-6266',
                orderId: best.id,
                folio: '6266',
                uuid: 'D053F7B5-5913-404D-8441-67D4A3E5EB9C',
                kilos: 1445.20,
                items: [
                  { id: 'it-th-4', code: 'enbo000006-sc', description: 'enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM', quantity: 1445.20, unitPrice: 43.0, amount: 62143.60, unit: 'KGM' },
                ],
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 62143.60,
                  invoiceTotal: 72086.58,
                  costTotal: 54917.60,
                  commission: 4971.49,
                  netCashFlow: 12197.49,
                  tradeMargin: 7226.00,
                },
                creditCycle: {
                  status: 'facturado',
                  issueDate: Timestamp.fromDate(new Date('2026-09-01T13:36:29Z')),
                  dueDate: null,
                },
              },
            ];
            const mergedThInvoices = baseInvoices.map(baseInv => {
              const existing = (best.invoices || []).find((i: any) => (i.folio || i.id) === (baseInv.folio || baseInv.id));
              if (existing) {
                return {
                  ...baseInv,
                  collection: {
                    ...(baseInv.collection || {}),
                    ...(existing.collection || {}),
                  },
                  creditCycle: {
                    ...(baseInv.creditCycle || {}),
                    ...(existing.creditCycle || {}),
                  },
                };
              }
              return baseInv;
            });
            best.invoices = mergedThInvoices;
          } else if (canonicalKey === '12026439713' || canonicalKey.includes('43/9713') || canonicalKey.includes('43-9713')) {
            const gtItems = [
              { id: 'it-gt-1', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM (80+20+20X125) _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-gt-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M (60+40X115) _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-gt-3', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M (80+40X160) _Sin Color', quantity: 700, unitPrice: 43.0, amount: 30100, unit: 'Kilos' },
              { id: 'it-gt-4', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM (60+40X95) _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            ];
            best.totalKilograms = 3700.0;
            best.items = gtItems;
            best.client = 'GRUPO TEXTIL PROVIDENCIA (GT - Evelia / P4)';
            best.department = 'P4-ALM';
            best.folio = '12026439713';
            best.oc = '12026439713';
            best.isClosedShort = true;
            (best as any).status = 'facturado';

            // 🎯 Reconciliación Canónica de Entregas GT (Total Físico Real: 2,674.00 kg)
            const reconciledGtDeliveries: Delivery[] = [
              {
                id: 'del-gt-9713',
                date: Timestamp.fromDate(new Date('2026-08-19T13:52:37Z')),
                kilos: 1000.0,
                items: [
                  { itemId: 'it-gt-2', quantity: 500.0 },
                  { itemId: 'it-gt-1', quantity: 500.0 },
                ],
                invoiced: true,
                invoiceId: 'inv-6193',
                docType: 'factura',
                docFolio: '6193',
              },
              {
                id: 'del-gt-6267',
                date: Timestamp.fromDate(new Date('2026-08-26T10:00:00Z')),
                kilos: 700.00,
                items: [
                  { itemId: 'it-gt-3', quantity: 700.00 },
                ],
                invoiced: true,
                invoiceId: 'inv-6267',
                docType: 'factura',
                docFolio: '6267',
                notes: 'Entrega física amparada por Factura XML #6267 (700.00 kg)',
              },
              {
                id: 'del-gt-6268',
                date: Timestamp.fromDate(new Date('2026-08-26T10:00:00Z')),
                kilos: 974.00,
                items: [
                  { itemId: 'it-gt-4', quantity: 974.00 },
                ],
                invoiced: true,
                invoiceId: 'inv-6268',
                docType: 'factura',
                docFolio: '6268',
                notes: 'Entrega física amparada por Factura XML #6268 (974.00 kg)',
              },
            ];
            best.deliveries = reconciledGtDeliveries;

            const baseGtInvoices: Invoice[] = [
              {
                id: 'inv-6193',
                orderId: best.id,
                folio: '6193',
                kilos: 1000.0,
                items: [
                  { id: 'it-gt-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M', quantity: 500.0, unitPrice: 43.0, amount: 21500.0, unit: 'KGM' },
                  { id: 'it-gt-1', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM', quantity: 500.0, unitPrice: 43.0, amount: 21500.0, unit: 'KGM' },
                ],
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 43000.0,
                  invoiceTotal: 49880.0,
                  costTotal: 38000.0,
                  commission: 3440.0,
                  netCashFlow: 8440.0,
                  tradeMargin: 5000.0,
                },
                collection: {
                  contrareciboNumber: 'GT-874',
                  contrareciboDate: Timestamp.fromDate(new Date('2026-08-24T00:00:00Z')),
                },
                creditCycle: {
                  status: 'pending',
                  issueDate: Timestamp.fromDate(new Date('2026-08-24T00:00:00Z')),
                  dueDate: Timestamp.fromDate(new Date('2026-09-23T00:00:00Z')),
                },
              },
              {
                id: 'inv-6267',
                orderId: best.id,
                folio: '6267',
                uuid: 'DAE3F1F3-D102-417F-8DD1-6C148ECED945',
                kilos: 700.0,
                items: [
                  { id: 'it-gt-3', code: 'EGBO000017-SC', description: 'EGBO000017-SC BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 700.0, unitPrice: 43.0, amount: 30100.0, unit: 'KGM' },
                ],
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 30100.0,
                  invoiceTotal: 34916.0,
                  costTotal: 26600.0,
                  commission: 2408.0,
                  netCashFlow: 5908.0,
                  tradeMargin: 3500.0,
                },
                creditCycle: {
                  status: 'facturado',
                  issueDate: Timestamp.fromDate(new Date('2026-09-01T13:37:42Z')),
                  dueDate: null,
                },
              },
              {
                id: 'inv-6268',
                orderId: best.id,
                folio: '6268',
                uuid: 'DB2F9D04-C4FC-49C7-B9AB-66D1F94F4D71',
                kilos: 974.0,
                items: [
                  { id: 'it-gt-4', code: 'EGBO000093-SC', description: 'EGBO000093-SC BOLSA POLIETILENO 100 X 95 CM (60+40x95)', quantity: 974.0, unitPrice: 43.0, amount: 41882.0, unit: 'KGM' },
                ],
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 41882.0,
                  invoiceTotal: 48583.12,
                  costTotal: 37012.0,
                  commission: 3350.56,
                  netCashFlow: 8220.56,
                  tradeMargin: 4870.0,
                },
                creditCycle: {
                  status: 'facturado',
                  issueDate: Timestamp.fromDate(new Date('2026-09-01T13:40:04Z')),
                  dueDate: null,
                },
              },
            ];
            const mergedGtInvoices = baseGtInvoices.map(baseInv => {
              const existing = (best.invoices || []).find((i: any) => (i.folio || i.id) === (baseInv.folio || baseInv.id));
              if (existing) {
                return {
                  ...baseInv,
                  collection: {
                    ...(baseInv.collection || {}),
                    ...(existing.collection || {}),
                  },
                  creditCycle: {
                    ...(baseInv.creditCycle || {}),
                    ...(existing.creditCycle || {}),
                  },
                };
              }
              return baseInv;
            });
            best.invoices = mergedGtInvoices;
          }

          deduplicatedDocs.push(best);
        }

        deduplicatedDocs.sort((a, b) => {
          const ta = toDate(a.processedAt)?.getTime() || toDate((a as any).createdAt)?.getTime() || 0;
          const tb = toDate(b.processedAt)?.getTime() || toDate((b as any).createdAt)?.getTime() || 0;
          return tb - ta;
        });
        setOrders(deduplicatedDocs);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(
          e.code === 'permission-denied'
            ? 'Firestore rechazó la lectura. Revisa que tu usuario exista en la colección admins y que las reglas estén desplegadas.'
            : e.message,
        );
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const value = useMemo(() => ({ orders, loading, error }), [orders, loading, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Si alguien lo usa fuera del proveedor, es un error de montaje: mejor que
 *  falle fuerte y visible que devolver una lista vacía que parezca datos. */
export function useOrdersContext(): OrdersState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useOrders debe usarse dentro de <OrdersProvider>. Revisa App.tsx.');
  }
  return ctx;
}
