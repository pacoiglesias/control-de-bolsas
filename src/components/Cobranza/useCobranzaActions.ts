import { doc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import { round2 } from '../../lib/finance';
import { confirmDialog } from '../../lib/confirmDialog';
import { promptDialog } from '../../lib/promptDialog';
import { sound } from '../../lib/sounds';
import { logAction } from '../../lib/logger';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import type { Tone } from '../../context/ToastContext';

// Extraido de Cobranza/index.tsx (era >1700 lineas en un solo archivo).
// Agrupa todas las mutaciones de Firestore relacionadas a cobranza
// (reprogramar vencimiento, marcar complemento, cobrar factura/CR en
// bloque, deshacer/revertir cobros, liquidar comisiones al contador).
//
// Mismo patron de seguridad en todas: runTransaction() relee el/los
// expediente(s) desde Firestore DENTRO de la transaccion (nunca desde el
// estado local `orders`/`data`, que puede estar desactualizado un tick
// respecto a lo que otro usuario o el saneador nocturno ya escribieron) y
// aplica el cambio por id de factura con aplicarPorId(). Cada escritura
// hace dual-write: el arreglo `invoices[]` dentro de `purchaseOrders/{id}`
// (legado) y el espejo `invoices/{invoiceId}` (migracion V2).
//
// `data` sigue viniendo de afuera (del useMemo en index.tsx) solo para
// FILTRAR que facturas pertenecen a un contrarecibo antes de armar la
// transaccion -- los valores que de verdad se escriben salen de releer
// Firestore, no de este `data`.

interface CobranzaActionsDeps {
  orders: PurchaseOrder[];
  data: { open: any[]; paid: any[]; collected: any[] };
  config: { salePricePerKg: number; ivaRate: number; commissionRate: number };
  toast: (msg: string, tone?: Tone, action?: { label: string; onClick: () => void }) => void;
  user: { email?: string | null } | null | undefined;
}

export function useCobranzaActions({ orders, data, config, toast, user }: CobranzaActionsDeps) {
  /**
   * "Reprogramar" — cambia la fecha de vencimiento de una factura en un
   * clic, sin abrir el expediente completo. Mismo patron de transaccion
   * segura que toggleComplementStatus: relee el expediente dentro de la
   * operacion en vez de escribir desde una copia local, para no pisar un
   * cambio simultaneo de otra persona.
   */
  async function reprogramarVencimiento(orderId: string, invoiceId: string, nuevaFecha: Date) {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe');

        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => ({
          ...x,
          creditCycle: { ...x.creditCycle, dueDate: Timestamp.fromDate(nuevaFecha) },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');

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
      });
      toast(`Vencimiento reprogramado al ${nuevaFecha.toLocaleDateString('es-MX')}`, 'ok');
    } catch (e) {
      toast(`Error al reprogramar: ${(e as Error).message}`, 'bad');
    }
  }

  async function toggleComplementStatus(orderId: string, invoiceId: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const invIndex = o.invoices?.findIndex(i => i.id === invoiceId);
    if (invIndex === undefined || invIndex < 0) return;

    const inv = o.invoices![invIndex];
    const current = inv.collection?.complementStatus;
    const nextStatus = current === 'issued' ? 'pending' : 'issued';

    try {
      // Transaccion: se relee el expediente dentro de la operacion y el cambio
      // se aplica por id de factura. Con el patron anterior se escribia el
      // arreglo completo desde una copia local del snapshot, asi que dos
      // usuarios simultaneos —o un usuario y el procesador de complementos
      // XML— se pisaban: el ultimo en escribir borraba lo del otro.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe');

        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => ({
          ...x,
          collection: { ...x.collection, complementStatus: nextStatus },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');

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
      });
      toast(`Complemento marcado como ${nextStatus === 'issued' ? 'Emitido' : 'Pendiente'}`, 'ok');
    } catch (e) {
      toast(`Error al actualizar complemento: ${(e as Error).message}`, 'bad');
    }
  }

  async function payInvoiceExact(orderId: string, invoiceId: string, amountToPay: number) {
    if (!(await confirmDialog(`¿Confirmas el cobro exacto por $${amountToPay.toLocaleString('es-MX', {minimumFractionDigits:2})} de esta factura?`))) return;

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe');

        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => ({
          ...x,
          creditCycle: { ...x.creditCycle, status: 'paid' },
          collection: {
            ...x.collection,
            paidAmount: amountToPay,
            paidAt: Timestamp.now(),
          },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');

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
      });
      sound.playChaChing();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast(`Factura cobrada con éxito.`, 'ok');
    } catch (e) {
      toast(`Error al cobrar factura: ${(e as Error).message}`, 'bad');
    }
  }

  async function payContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!(await confirmDialog(`¿Seguro que quieres cobrar todas las facturas pendientes del Contrarecibo ${crNumber}?`))) return;

    const doctoSap = (await promptDialog('Docto. SAP (Opcional):')) || '';
    const doctoPago = (await promptDialog('Docto. Pago (Opcional, ej. TR_3583):')) || '';

    const invoicesToPay = data.open.filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    // Que facturas hay que tocar en cada expediente. Los datos frescos se
    // leen dentro de la transaccion, no de este snapshot.
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToPay) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      // writeBatch garantizaba atomicidad (todo o nada) pero no aislamiento:
      // seguia escribiendo el arreglo completo desde una copia local. La
      // transaccion relee cada expediente y aplica los cambios por id.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        // Firestore exige TODAS las lecturas antes de cualquier escritura.
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'paid' },
              collection: {
                ...x.collection,
                paidAmount: x.financials?.invoiceTotal ?? x.financials?.saleTotal ?? 0,
                paidAt: Timestamp.now(),
                sapDocument: doctoSap,
                paymentDocument: doctoPago
              },
            }));
            if (nuevas) {
              invoices = nuevas;
              const invModificada = nuevas.find(x => x.id === invoiceId);
              if (invModificada) {
                tx.set(doc(db, PATHS.invoices, invoiceId), {
                  ...invModificada,
                  orderId: id,
                  client: snap.data().client ?? '',
                  department: snap.data().department ?? '',
                }, { merge: true });
              }
            }
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      sound.playChaChing();
      confetti({ particleCount: 250, spread: 120, origin: { y: 0.5 } });
      toast(`Contrarecibo ${crNumber} cobrado exitosamente`, 'ok');
    } catch (e) {
      toast(`Error al procesar el cobro en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  async function undoContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!(await confirmDialog({ message: `¿Seguro que quieres DESHACER el cobro del Contrarecibo ${crNumber}? Las facturas volverán a pendientes.`, danger: true }))) return;

    const invoicesToUndo = data.paid.filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToUndo) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'pending' },
              collection: {
                ...x.collection,
                paidAmount: 0,
                paidAt: null,
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      toast(`Cobro del Contrarecibo ${crNumber} deshecho.`, 'ok');
    } catch (e) {
      toast(`Error al deshacer cobro: ${(e as Error).message}`, 'bad');
    }
  }

  async function fastCollectContrareciboBlock(crNumber: string, defaultTransferRef?: string) {
    if (!crNumber) return;

    const invoices = [...data.open, ...data.paid].filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    if (invoices.length === 0) {
      toast(`No se encontraron facturas activas para el Contrarecibo ${crNumber}`, 'bad');
      return;
    }

    const totalFacturas = invoices.reduce((acc, { inv }) => acc + (inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0), 0);
    const totalComision = invoices.reduce((acc, { inv }) => acc + (inv.financials?.commission ?? 0), 0);
    const netoEstimado = totalFacturas - totalComision;

    const transferRef = ((await promptDialog({
      message: `⚡ Cobro Rápido con Transferencia del Contrarecibo ${crNumber}\n` +
        `Total Facturas: $${totalFacturas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
        `Comisión Contador (8%): -$${totalComision.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
        `Ingreso Neto a CAJA: $${netoEstimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n` +
        `Ingresa la Referencia de Transferencia (ej. TR_3640):`,
      defaultValue: defaultTransferRef || 'TR_'
    })) || '').trim();

    if (!transferRef) return;

    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoices) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    let netCobradoReal = 0;

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));
        netCobradoReal = 0;

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let currentInvoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const inv = currentInvoices.find((x) => x.id === invoiceId);
            if (inv) {
              const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
              const comision = inv.financials?.commission ?? 0;
              netCobradoReal += (invTotal - comision);
            }
            const nuevas = aplicarPorId(currentInvoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'collected' },
              collection: {
                ...x.collection,
                paidAmount: x.financials?.invoiceTotal ?? x.financials?.saleTotal ?? 0,
                paidAt: Timestamp.now(),
                collectedAt: Timestamp.now(),
                paymentDocument: transferRef,
                transferRef: transferRef,
              },
            }));
            if (nuevas) {
              currentInvoices = nuevas;
              const invModificada = nuevas.find((x) => x.id === invoiceId);
              if (invModificada) {
                tx.set(doc(db, PATHS.invoices, invoiceId), {
                  ...invModificada,
                  orderId: id,
                  client: snap.data().client ?? '',
                  department: snap.data().department ?? '',
                }, { merge: true });
              }
            }
          }
          tx.update(ref, camposInvoices(currentInvoices));
        });

        netCobradoReal = round2(netCobradoReal);

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Cobro ${transferRef} (Contrarecibo ${crNumber})`,
          type: 'ingreso',
          amount: netCobradoReal,
          createdAt: Timestamp.now(),
        });
      });

      sound.playChaChing();
      confetti({ particleCount: 250, spread: 120, origin: { y: 0.5 } });
      toast(`⚡ Cobro y recolección de ${crNumber} (${transferRef}) completados. $${netCobradoReal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ingresados a CAJA.`, 'ok');
    } catch (e) {
      toast(`Error en cobro rápido: ${(e as Error).message}`, 'bad');
    }
  }

  async function collectContrareciboBlock(crNumber: string, netCobrado: number) {
    if (!crNumber) return;
    if (!(await confirmDialog(`¿Recibiste el EFECTIVO/TRANSFERENCIA del Contrarecibo ${crNumber}? Se registrará un Ingreso por $${netCobrado.toLocaleString('es-MX', {minimumFractionDigits:2})} en CAJA.`))) return;

    // Referencia de la transferencia (ej. "TR_3583"), distinta del numero de
    // contrarecibo (ej. "GT-570"): sin ella no se puede conciliar el deposito
    // contra el estado de cuenta bancario despues.
    const transferRef = ((await promptDialog('Referencia de la transferencia (opcional, ej. TR_3583):')) || '').trim();

    const invoicesToCollect = data.paid.filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToCollect) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    // Declarado FUERA de la transaccion: el toast de exito de abajo necesita
    // leerlo despues de que runTransaction termine, y una variable `let`
    // declarada dentro del callback no existe fuera de el. Esto no compilaba.
    let netCobradoReal = 0;

    try {
      // El movimiento de Caja Chica va DENTRO de la misma transaccion que el
      // cambio de estatus. Si se separaran, un fallo a la mitad podria dejar
      // el ingreso registrado sin las facturas marcadas, o al reves.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        // netCobrado se recalcula AQUI, con los datos releidos dentro de la
        // transaccion, en vez de usar el parametro que llega desde el render.
        // Antes viajaba tal cual desde la pantalla: si el saneador nocturno,
        // un complemento XML u otro usuario tocaban financials entre el render
        // y el clic, el ingreso inyectado en Caja Chica quedaba desactualizado
        // y nada lo detectaba despues.
        netCobradoReal = 0;

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const inv = invoices.find((x) => x.id === invoiceId);
            if (inv) {
              const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
              const comision = inv.financials?.commission ?? 0;
              // Lo que entra a Caja Chica: la factura completa menos el
              // honorario del contador. Sin restar el costo del material.
              netCobradoReal += invTotal - comision;
            }
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'collected' },
              collection: { ...x.collection, collectedAt: Timestamp.now(), transferRef: transferRef || x.collection?.transferRef || '' },
            }));
            if (nuevas) {
              invoices = nuevas;
              const invModificada = nuevas.find(x => x.id === invoiceId);
              if (invModificada) {
                tx.set(doc(db, PATHS.invoices, invoiceId), {
                  ...invModificada,
                  orderId: id,
                  client: snap.data().client ?? '',
                  department: snap.data().department ?? '',
                }, { merge: true });
              }
            }
          }
          tx.update(ref, camposInvoices(invoices));
        });

        netCobradoReal = round2(netCobradoReal);

        // Un peso de tolerancia por redondeo; mas que eso significa que algo
        // cambio de verdad entre el render y el clic.
        if (Math.abs(netCobradoReal - netCobrado) > 1) {
          throw new Error(
            `El importe cambió desde que se mostró en pantalla ` +
            `($${netCobrado.toFixed(2)} → $${netCobradoReal.toFixed(2)}). ` +
            `Cierra este cuadro, revisa el Contrarecibo ${crNumber} e intenta de nuevo.`,
          );
        }

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Cobro del Contrarecibo ${crNumber}`,
          type: 'ingreso',
          amount: netCobradoReal,
          createdAt: Timestamp.now(),
        });
      });
      toast(`💰 Contrarecibo ${crNumber} recogido ($${netCobradoReal.toLocaleString('es-MX', {minimumFractionDigits:2})} ingresados a CAJA). Se movió a la pestaña "Historial: Recogidos" donde puedes deshacerlo en cualquier momento.`, 'ok', {
        label: '↩️ Deshacer',
        onClick: () => revertCollectedContrareciboBlock(crNumber)
      });
    } catch (e) {
      toast(`Error al procesar la recolección en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  async function revertCollectedContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!(await confirmDialog({ message: `¿DESHACER RECOLECCIÓN del Contrarecibo ${crNumber}? El lote regresará a "Por Recoger Dinero" y se registrará un egreso de reversión en CAJA.`, danger: true }))) return;

    const invoicesToRevert = data.collected.filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    const objetivo: Record<string, string[]> = {};
    let totalRevertir = 0;
    for (const { o, inv } of invoicesToRevert) {
      (objetivo[o.id] ??= []).push(inv.id);
      const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * config.salePricePerKg * (1 + config.ivaRate));
      const comision = inv.financials?.commission ?? (inv.kilos * config.salePricePerKg * config.commissionRate);
      totalRevertir += (invTotal - comision);
    }

    if (Object.keys(objetivo).length === 0) {
      toast('No se encontraron facturas recogidas para este contrarecibo.', 'bad');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'paid' },
              collection: {
                ...x.collection,
                collectedAt: null,
              },
            }));
            if (nuevas) {
              invoices = nuevas;
              const invModificada = nuevas.find(x => x.id === invoiceId);
              if (invModificada) {
                tx.set(doc(db, PATHS.invoices, invoiceId), {
                  ...invModificada,
                  orderId: id,
                  client: snap.data().client ?? '',
                  department: snap.data().department ?? '',
                }, { merge: true });
              }
            }
          }
          tx.update(ref, camposInvoices(invoices));
        });

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Reversión de Recolección Contrarecibo ${crNumber}`,
          type: 'egreso',
          amount: round2(totalRevertir),
          createdAt: Timestamp.now(),
        });
      });

      logAction(user?.email, 'Reversión de Recolección', { contrarecibo: crNumber, monto: totalRevertir });
      sound.playPop();
      toast(`↩️ Recolección del Contrarecibo ${crNumber} revertida. Regresado a "Por Recoger" y egreso por $${totalRevertir.toLocaleString('es-MX', {minimumFractionDigits:2})} registrado en CAJA.`, 'ok');
    } catch (e) {
      sound.playError();
      toast(`Error al revertir la recolección: ${(e as Error).message}`, 'bad');
    }
  }

  async function liquidateAccountantBlock(crNumber: string) {
    if (!crNumber) return;
    if (!(await confirmDialog(`¿Seguro que quieres MARCAR como pagada (liquidada) la comisión al contador para el CR ${crNumber}?`))) return;

    // Buscamos todas las facturas de ese CR (que esten paid o collected)
    const allCrInvoices = [...data.paid, ...data.collected].filter(({ o, inv }: any) =>
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );

    const objetivo: Record<string, string[]> = {};
    let hasPending = false;
    for (const { o, inv } of allCrInvoices) {
      if (!inv.collection?.accountantLiquidated) {
        (objetivo[o.id] ??= []).push(inv.id);
        hasPending = true;
      }
    }

    if (!hasPending) {
      toast('Todas las comisiones de este contrarecibo ya estaban liquidadas.', 'info');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              collection: {
                ...x.collection,
                accountantLiquidated: true,
                accountantLiquidatedAt: Timestamp.now()
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      sound.playSuccess();
      toast(`✅ Comisiones del Contrarecibo ${crNumber} liquidadas a contabilidad`, 'ok');
    } catch (e) {
      sound.playError();
      toast(`Error al liquidar comisiones: ${(e as Error).message}`, 'bad');
    }
  }

  return {
    reprogramarVencimiento,
    toggleComplementStatus,
    payInvoiceExact,
    payContrareciboBlock,
    fastCollectContrareciboBlock,
    undoContrareciboBlock,
    collectContrareciboBlock,
    revertCollectedContrareciboBlock,
    liquidateAccountantBlock,
  };
}
