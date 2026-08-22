import { useRef } from 'react';
import { doc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import { computeCommissionFromInvoiceTotal } from '../../lib/finance';
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

    const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
    let currentCol = '';
    if (inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') {
      currentCol = cr ? 'colPorCobrar' : 'colRevision';
    } else if (inv.creditCycle.status === 'paid') {
      currentCol = 'colContador';
    } else if (inv.creditCycle.status === 'collected') {
      currentCol = 'colCaja';
    }

    if (currentCol === targetCol) return;

    let newStatus = inv.creditCycle.status;
    let newCr = inv.collection?.contrareciboNumber;
    let expenseData: any = null;

    if (targetCol === 'colRevision') {
      if (currentCol !== 'colPorCobrar') {
         toast('Solo puedes regresar a Revisión desde Por Cobrar.', 'bad'); return;
      }
      if (o.collection?.contrareciboNumber) {
        toast('El Contrarecibo está a nivel Expediente. Edita el expediente para borrarlo.', 'bad');
        return;
      }
      // Antes esto borraba el CR en silencio -- el usuario lo movia de
      // vuelta sin darse cuenta de que perdia el numero, y al intentar
      // regresarlo el sistema se lo volvia a pedir desde cero, como si
      // nunca lo hubiera tenido. Ahora se confirma explicitamente, y el
      // numero que se borra se recuerda para poder restaurarlo con un
      // clic si fue un movimiento accidental.
      const crActual = inv.collection?.contrareciboNumber || '';
      if (!(await confirmDialog(`Esto borra el número de Contrarecibo (${crActual}) de esta factura. ¿Seguro que quieres moverla a Revisión?`))) {
        return;
      }
      if (crActual) crRecordados.current[invoiceId] = crActual;
      newStatus = 'pending';
      newCr = undefined; // Se usará undefined para limpiarlo después
    } else if (targetCol === 'colPorCobrar') {
      if (currentCol === 'colRevision') {
         const crAnterior = crRecordados.current[invoiceId] || '';
         const promptCr = await promptDialog({
           message: crAnterior ? `Ingresa el número de Contrarecibo (CR):\n\n(Antes tenía "${crAnterior}" — bórralo del cuadro si es un número distinto)` : 'Ingresa el número de Contrarecibo (CR):',
           defaultValue: crAnterior,
         });
         if (!promptCr) return;
         newCr = promptCr.trim();
      } else if (currentCol === 'colContador') {
         newStatus = 'pending';
      } else {
         toast('Movimiento no permitido.', 'bad'); return;
      }
    } else if (targetCol === 'colContador') {
      if (currentCol === 'colPorCobrar') {
         newStatus = 'paid';
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
         newStatus = 'paid';
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
         newStatus = 'collected';
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
             delete collectionUpdate.contrareciboNumber;
          } else if (newCr !== undefined) {
             collectionUpdate.contrareciboNumber = newCr;
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
            creditCycle: { ...x.creditCycle, status: newStatus as any },
            collection: collectionUpdate
          };
        });

        if (!nuevas) throw new Error('La factura no está en el expediente');
        tx.update(ref, camposInvoices(nuevas));

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
