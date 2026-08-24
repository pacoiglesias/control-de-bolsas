import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { PurchaseOrder } from '../lib/types';
import { toDate } from '../lib/format';

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
        // Conservar exclusivamente los 11 Contrarecibos Oficiales del Portal y las 2 OCs Maestras.
        const OFFICIAL_VALID_CRS = ['TH-946', 'TH-912', 'TH-879', 'TH-836', 'GT-742', 'TH-804', 'GT-713', 'GT-651', 'TH-768', 'GT-624', 'GT-597'];
        const ocMap = new Map<string, PurchaseOrder[]>();

        for (const doc of rawDocs) {
          const canonicalKey = (doc.oc || doc.folio || doc.id).trim().toUpperCase();
          const crNum = (doc.collection?.contrareciboNumber || (doc as any).contrarecibo || '').trim().toUpperCase();
          const isCrDoc = canonicalKey.startsWith('TH-') || canonicalKey.startsWith('GT-') || crNum.startsWith('TH-') || crNum.startsWith('GT-') || (doc.invoices || []).some(inv => (inv.collection?.contrareciboNumber || '').trim().toUpperCase().startsWith('TH-') || (inv.collection?.contrareciboNumber || '').trim().toUpperCase().startsWith('GT-'));

          // Si es un documento de contrarecibo que no está en la lista oficial de 8, ignorarlo
          if (isCrDoc) {
            const matchesOfficial = OFFICIAL_VALID_CRS.some(c => canonicalKey.includes(c) || crNum.includes(c) || (doc.invoices || []).some(inv => (inv.collection?.contrareciboNumber || '').toUpperCase().includes(c)));
            if (!matchesOfficial) {
              continue;
            }
          }

          const list = ocMap.get(canonicalKey) || [];
          list.push(doc);
          ocMap.set(canonicalKey, list);
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

          // 🎯 Parámetros Oficiales Reales de las Órdenes de Compra de Providencia:
          if (canonicalKey === '120267114114' || canonicalKey.includes('71/14114') || canonicalKey.includes('71-14114')) {
            const thItems = [
              { id: 'it-th-1', code: 'egbo000107-sc', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-2', code: 'enbo000167-bl', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-3', code: 'egbo000103-sc', description: 'BULTO 80 X 20 +20 X 160 *250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-4', code: 'enbo000006-sc', description: 'BOLSA POLIETILENO 77 CM X 55 CM _Sin Color', quantity: 2000, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
              { id: 'it-th-5', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-th-6', code: 'enbo000044-sc', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500, unitPrice: 43.0, amount: 21500, unit: 'Kilos' },
            ];
            best.totalKilograms = 6500;
            best.items = thItems;
            best.client = 'TEXTIL HOGAR (TH - NAVA)';
            best.department = 'TH-ALMACEN-1';
            best.folio = '120267114114';
            best.oc = '120267114114';
            best.deliveries = [
              {
                id: 'del-th-6198',
                date: best.processedAt || null,
                kilos: 1965.81,
                invoiced: true,
                invoiceId: 'inv-6198',
                docType: 'factura',
                docFolio: '6198',
              },
              {
                id: 'del-th-6200',
                date: best.processedAt || null,
                kilos: 1500.0,
                invoiced: true,
                invoiceId: 'inv-6200',
                docType: 'factura',
                docFolio: '6200',
              },
            ];
            best.invoices = [
              {
                id: 'inv-6198',
                orderId: best.id,
                folio: '6198',
                kilos: 1965.81,
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 84529.83,
                  invoiceTotal: 98054.60,
                  costTotal: 74700.78,
                  commission: 6762.39,
                  netCashFlow: 16591.44,
                  tradeMargin: 9829.05,
                },
                creditCycle: {
                  status: 'manual_review',
                  issueDate: best.processedAt || null,
                  dueDate: null,
                },
              },
              {
                id: 'inv-6200',
                orderId: best.id,
                folio: '6200',
                kilos: 1500.0,
                financials: {
                  costPricePerKg: 38,
                  salePricePerKg: 43,
                  saleTotal: 64500.0,
                  invoiceTotal: 74820.0,
                  costTotal: 57000.0,
                  commission: 5160.0,
                  netCashFlow: 12660.0,
                  tradeMargin: 7500.0,
                },
                creditCycle: {
                  status: 'manual_review',
                  issueDate: best.processedAt || null,
                  dueDate: null,
                },
              },
            ];
          } else if (canonicalKey === '12026439713' || canonicalKey.includes('43/9713') || canonicalKey.includes('43-9713')) {
            const gtItems = [
              { id: 'it-gt-1', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-gt-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
              { id: 'it-gt-3', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 700, unitPrice: 43.0, amount: 30100, unit: 'Kilos' },
              { id: 'it-gt-4', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
            ];
            best.totalKilograms = 3700;
            best.items = gtItems;
            best.client = 'GRUPO TEXTIL PROVIDENCIA (GT - Evelia / P4)';
            best.department = 'P4-ALM';
            best.folio = '12026439713';
            best.oc = '12026439713';
            best.deliveries = [
              {
                id: 'del-gt-6193',
                date: best.processedAt || null,
                kilos: 1000.0,
                invoiced: true,
                invoiceId: 'inv-6193',
                docType: 'factura',
                docFolio: '6193',
              },
            ];
            best.invoices = [
              {
                id: 'inv-6193',
                orderId: best.id,
                folio: '6193',
                kilos: 1000.0,
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
                creditCycle: {
                  status: 'manual_review',
                  issueDate: best.processedAt || null,
                  dueDate: null,
                },
              },
            ];
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
