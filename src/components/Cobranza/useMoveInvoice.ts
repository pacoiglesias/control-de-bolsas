import { useRef } from 'react';
import { doc, Timestamp, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import { computeCommissionFromInvoiceTotal, extractCr } from '../../lib/finance';
import { confirmDialog } from '../../lib/confirmDialog';
import { promptDialog } from '../../lib/promptDialog';
import type { PurchaseOrder } from '../../lib/types';
import type { Tone } from '../../context/ToastContext';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): `moveInvoice` (el
 * handler de drag&drop del tablero Kanban) vivía como función completa
 * dentro del componente, junto con el `useRef` de `crRecordados` que solo
 * este handler usa. Se extrae aquí como su propio hook, sin cambiar la
 * lógica ni la firma que ya consume `ctx.moveInvoice` en TableroKanban.
 */
export function useMoveInvoice({
  orders,
  config,
  toast,
}: {
  orders: PurchaseOrder[];
  config: any;
  toast: (msg: string, tone?: Tone) => void;
}) {
  // Recuerda el CR que se borro al mover una tarjeta de vuelta a Revision,
  // por si el movimiento fue accidental y la regresan a Por Cobrar poco
  // despues -- evita tener que volver a escribirlo desde cero.
  const crRecordados = useRef<Record<string, string>>({});

  async function moveInvoice(orderId: string, invoiceId: string, targetCol: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const inv = o.invoices?.find(i => i.id === invoiceId);
    if (!inv) return;

    const cr = (inv.collection?.contrareciboNumber || extractCr(inv, o)).trim();
    const st = (inv.creditCycle?.status || '').toLowerCase();

    let currentCol: 'colRevision' | 'colPorCobrar' | 'colContador' | 'colCaja' | '' = '';
    if (st === 'paid') {
      currentCol = 'colContador';
    } else if (st === 'collected') {
      currentCol = 'colCaja';
    } else if (st === 'revision' || !cr) {
      currentCol = 'colRevision';
    } else {
      currentCol = 'colPorCobrar';
    }

    if (currentCol === targetCol) return;

    let newCreditStatus: string = inv.creditCycle.status;
    let newCr = inv.collection?.contrareciboNumber;
    let expenseData: any = null;

    if (targetCol === 'colRevision') {
      if (currentCol !== 'colPorCobrar') {
        toast('Solo puedes regresar a Revisión desde Por Cobrar.', 'bad'); return;
      }
      const crActual = inv.collection?.contrareciboNumber || extractCr(inv, o) || '';
      if (!(await confirmDialog(`Esto retira el número de Contrarecibo (${crActual || 'asignado'}) de esta factura y la coloca en Revisión del Portal. ¿Seguro que deseas continuar?`))) {
        return;
      }
      if (crActual) crRecordados.current[invoiceId] = crActual;
      newCreditStatus = 'revision';
      newCr = '';
    } else if (targetCol === 'colPorCobrar') {
      if (currentCol === 'colRevision') {
        const crAnterior = crRecordados.current[invoiceId] || '';
        const promptCr = await promptDialog({
          message: crAnterior ? `Ingresa el número de Contrarecibo (CR):\n\n(Anteriormente: "${crAnterior}")` : 'Ingresa el número de Contrarecibo (CR, ej. GT-1047 o TH-1195):',
          defaultValue: crAnterior,
        });
        if (!promptCr || !promptCr.trim()) return;
        newCr = promptCr.trim().toUpperCase();
        newCreditStatus = 'pending';
      } else if (currentCol === 'colContador') {
        newCreditStatus = 'pending';
      } else {
        toast('Movimiento no permitido.', 'bad'); return;
      }
    } else if (targetCol === 'colContador') {
      if (currentCol === 'colPorCobrar') {
         newCreditStatus = 'paid';
      } else if (currentCol === 'colCaja') {
         if (!(await confirmDialog('¿Seguro que quieres deshacer la recolección? Se registrará un egreso de reversión en Caja para cuadrar.'))) return;

         const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * (config.salePricePerKg || 43) * (1 + (config.ivaRate || 0.16)));
         // FIX (v8.9.9, auditoría Staff Engineer): este respaldo ignoraba
         // config.commissionBase (siempre calculaba sobre el subtotal).
         // Usa la misma función única de verdad que ya usan CajaChica.tsx
         // y PagarAndresModal.tsx.
         const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(invTotal, config as any);
         const net = invTotal - comision;

         expenseData = {
           id: doc(collection(db, PATHS.expenses)).id,
           date: Timestamp.now(),
           concept: `[REVERSO] Corrección de factura ${inv.folio || o.folio}`,
           amount: net,
           type: 'egreso',
           createdAt: Timestamp.now(),
         };
         newCreditStatus = 'paid';
      } else {
         toast('Movimiento no permitido.', 'bad'); return;
      }
    } else if (targetCol === 'colCaja') {
      if (currentCol === 'colContador') {
         if (!(await confirmDialog(`¿Confirmas que se recibió el EFECTIVO/TRANSFERENCIA por la factura ${inv.folio || o.folio}? Se registrará el ingreso en Caja.`))) return;

         const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * (config.salePricePerKg || 43) * (1 + (config.ivaRate || 0.16)));
         // FIX (v8.9.9, auditoría Staff Engineer): este respaldo ignoraba
         // config.commissionBase (siempre calculaba sobre el subtotal).
         // Usa la misma función única de verdad que ya usan CajaChica.tsx
         // y PagarAndresModal.tsx.
         const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(invTotal, config as any);
         const net = invTotal - comision;

         expenseData = {
           id: doc(collection(db, PATHS.expenses)).id,
           date: Timestamp.now(),
           concept: `Cobro Fac. ${inv.folio || o.folio}`,
           amount: net,
           type: 'ingreso',
           createdAt: Timestamp.now(),
         };
         newCreditStatus = 'collected';
      } else {
         toast('Solo puedes mover a Caja desde la columna del Contador.', 'bad'); return;
      }
    }

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Expediente no existe');

        const actuales = snap.data().invoices ?? [];

        const nuevas = aplicarPorId(actuales, invoiceId, (x) => {
          const collectionUpdate = { ...x.collection };

          if (targetCol === 'colRevision') {
             collectionUpdate.contrareciboNumber = '';
             collectionUpdate.contrareciboPortalStatus = 'sin_numero';
          } else if (newCr !== undefined) {
             collectionUpdate.contrareciboNumber = newCr;
             collectionUpdate.contrareciboPortalStatus = 'generado';
             if (!collectionUpdate.contrareciboDate) {
               collectionUpdate.contrareciboDate = Timestamp.now();
             }
          }

          if (targetCol === 'colContador' && currentCol === 'colPorCobrar') {
             collectionUpdate.paidAt = Timestamp.now();
          }
          if (targetCol === 'colCaja' && currentCol === 'colContador') {
             collectionUpdate.collectedAt = Timestamp.now();
          }
          if (targetCol === 'colContador' && currentCol === 'colCaja') {
             collectionUpdate.collectedAt = null;
          }
          if (targetCol === 'colPorCobrar' && currentCol === 'colContador') {
             collectionUpdate.paidAt = null;
          }

          return {
            ...x,
            creditCycle: { ...x.creditCycle, status: newCreditStatus as any },
            collection: collectionUpdate
          };
        });

        if (!nuevas) throw new Error('La factura no está en el expediente');
        const orderUpdatePayload: any = {
          ...camposInvoices(nuevas),
          updatedAt: serverTimestamp(),
        };
        if (targetCol === 'colRevision') {
          orderUpdatePayload['collection.contrareciboNumber'] = '';
          orderUpdatePayload['collection.contrareciboPortalStatus'] = 'sin_numero';
        } else if (newCr) {
          orderUpdatePayload['collection.contrareciboNumber'] = newCr;
          orderUpdatePayload['collection.contrareciboPortalStatus'] = 'generado';
        }
        tx.update(ref, orderUpdatePayload);

        // ==== MIGRACION V2: Dual-write ====
        const invModificada = nuevas.find(x => x.id === invoiceId);
        if (invModificada) {
          tx.set(doc(db, PATHS.invoices, invoiceId), {
            ...invModificada,
            orderId,
            client: snap.data().client ?? '',
            department: snap.data().department ?? '',
          }, { merge: true });
        }

        if (expenseData) {
          tx.set(doc(db, PATHS.expenses, expenseData.id), expenseData);
        }
      });
      toast('Factura movida con éxito', 'ok');
    } catch (e) {
      toast(`Error al mover factura: ${(e as Error).message}`, 'bad');
    }
  }

  return moveInvoice;
}
