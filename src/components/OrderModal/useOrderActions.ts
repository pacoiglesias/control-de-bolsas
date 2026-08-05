import { doc, setDoc, getDocs, collection, runTransaction, serverTimestamp, Timestamp, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PATHS } from '../../lib/firebase';
import { Invoice } from '../../lib/types';
import { computeFinancials } from '../../lib/finance';
import { camposInvoices } from '../../lib/invoiceOps';
import { computeDeliveredTotals, upsertAndresPurchase } from '../../lib/deliveries';
import { safeDeleteDoc, logAction } from '../../lib/logger';

export function useOrderActions() {
  async function saveOrder({
    form, order, kilosNum, allOrders, dynamicConfig, baselineUpdatedAt, userEmail, toast, setBusy, onClose, liveSummary, materialProviderName
  }: any) {
    // ANTES: exigia kilosNum > 0 SIEMPRE, incluso para editar un
    // expediente que ya tiene facturas reales con kilos capturados a
    // nivel factura -- el campo resumen "Kilos Pedidos (Total)" nunca se
    // lleno en la migracion original, asi que CUALQUIER edicion a ese
    // expediente (hasta corregir un numero de contrarecibo) quedaba
    // bloqueada por un campo que no tenia nada que ver con lo que se
    // estaba editando. Ahora tambien cuenta los kilos ya capturados en
    // las facturas del expediente.
    const kilosDeFacturas = (form.invoices || []).reduce((acc: number, i: any) => acc + (i.kilos || 0), 0);
    if (kilosNum <= 0 && kilosDeFacturas <= 0) {
      toast('Los kilos totales del pedido deben ser mayores a cero.', 'bad');
      return;
    }
    if (!form.client.trim()) {
      toast('Falta el nombre del cliente. No se puede guardar un expediente sin él.', 'bad');
      return;
    }
    if (!form.provider.trim() && kilosDeFacturas <= 0) {
      toast('Falta el nombre del proveedor. No se puede guardar un expediente sin él.', 'bad');
      return;
    }
    const folioTrim = form.folio.trim();
    if (folioTrim) {
      const duplicado = allOrders.find((o: any) => o.id !== order.id && (o.folio ?? '').trim() === folioTrim);
      if (duplicado) {
        const continuar = window.confirm(
          `Ya existe otro expediente con el folio "${folioTrim}" (cliente: ${duplicado.client || '—'}). ` +
          `¿Seguro que quieres guardar de todos modos?`,
        );
        if (!continuar) return;
      }
    }
    // El numero real de OC (distinto del folio interno) nunca deberia
    // repetirse entre expedientes -- no tenia ninguna verificacion antes.
    const ocTrim = (form.oc || '').trim();
    if (ocTrim) {
      const ocDuplicada = allOrders.find((o: any) => o.id !== order.id && (o.oc ?? '').trim() === ocTrim);
      if (ocDuplicada) {
        const continuar = window.confirm(
          `Ya existe otro expediente con el número de OC "${ocTrim}" (cliente: ${ocDuplicada.client || '—'}). ` +
          `¿Seguro que quieres guardar de todos modos?`,
        );
        if (!continuar) return;
      }
    }
    const ccp = form.customCostPrice !== '' ? Number(form.customCostPrice) : undefined;
    const csp = form.customSellPrice !== '' ? Number(form.customSellPrice) : undefined;
    const ccr = form.customCommissionRate !== '' ? Number(form.customCommissionRate) : undefined;

    if ((ccp !== undefined && isNaN(ccp)) || (csp !== undefined && isNaN(csp)) || (ccr !== undefined && isNaN(ccr))) {
      toast('Por favor, ingresa solo números válidos en Costo, Precio o Comisión.', 'bad');
      return;
    }

    const { kilosEntregados: kilosEntregadosActuales } = computeDeliveredTotals(form.deliveries);
    const kilosPedidosActuales = form.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
    const tol = (dynamicConfig as any).weightTolerancePercentage ?? 2;
    const maxKilos = kilosPedidosActuales * (1 + tol / 100);
    
    if (kilosEntregadosActuales > maxKilos && kilosPedidosActuales > 0) {
      toast(`No se puede guardar: has registrado ${kilosEntregadosActuales.toLocaleString('es-MX')} kg entregados, superando el límite de tolerancia (${tol}%) sobre los ${kilosPedidosActuales.toLocaleString('es-MX')} kg pedidos (Máximo permitido: ${maxKilos.toLocaleString('es-MX')} kg).`, 'bad');
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, PATHS.orders, order.id);
      
      const updatedInvoices = form.invoices.map((inv: any) => {
        const snapshotCfg = {
          ...dynamicConfig,
          salePricePerKg: (form.customSellPrice !== undefined && form.customSellPrice !== '') ? dynamicConfig.salePricePerKg : (inv.financials?.salePricePerKg || dynamicConfig.salePricePerKg),
          costPricePerKg: (form.customCostPrice !== undefined && form.customCostPrice !== '') ? dynamicConfig.costPricePerKg : (inv.financials?.costPricePerKg || dynamicConfig.costPricePerKg),
          commissionRate: (form.customCommissionRate !== undefined && form.customCommissionRate !== '') ? dynamicConfig.commissionRate : (inv.financials?.commissionRate || dynamicConfig.commissionRate),
        };

        const crNum = inv.collection?.contrareciboNumber?.trim() || '';
        const folioStr = inv.folio?.trim() || '';
        const finalFolio = (crNum && !folioStr) ? 'S/N' : folioStr;

        return {
          ...inv,
          folio: finalFolio,
          financials: computeFinancials(inv.kilos, snapshotCfg),
          collection: inv.collection ? {
            ...inv.collection,
            contrareciboNumber: crNum
          } : undefined
        };
      });

      const qs = await getDocs(collection(db, PATHS.orders));
      for (const inv of updatedInvoices) {
        if (!inv.folio || inv.folio === 'S/N') continue;
        const upperFolio = inv.folio.toUpperCase();
        for (const doc of qs.docs) {
          if (doc.id === order.id) continue;
          const otherInvoices = doc.data().invoices || [];
          if (otherInvoices.some((x: Invoice) => x.folio && x.folio.toUpperCase() === upperFolio)) {
            toast(`Bloqueado: El folio de factura ${inv.folio} ya está registrado en el expediente ${doc.data().folio || doc.id}.`, 'bad');
            setBusy(false);
            return;
          }
        }
      }

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        // Solo se exige que el expediente YA exista cuando estamos editando
        // uno que se leyo antes (baselineUpdatedAt viene de esa lectura
        // previa). Un expediente nuevo (creado via "+ Expediente Manual",
        // "Subir/Pegar OC" o "Venta Manual") todavia no existe en Firestore
        // la primera vez que se guarda — eso es lo esperado, no un error.
        // Antes esta linea exigia snap.exists() siempre, asi que guardar
        // CUALQUIER expediente nuevo por primera vez tronaba con "El
        // expediente ya no existe", sin importar que nunca hubiera existido
        // para empezar.
        if (!snap.exists() && baselineUpdatedAt) {
          throw new Error('El expediente ya no existe.');
        }

        const freshUpdatedAt = (snap.data()?.updatedAt as Timestamp | undefined) ?? null;
        if (
          baselineUpdatedAt &&
          freshUpdatedAt &&
          freshUpdatedAt.toMillis() !== baselineUpdatedAt.toMillis()
        ) {
          throw new Error(
            'Este expediente fue modificado por otra persona mientras lo editabas. ' +
            'Ciérralo y vuelve a abrirlo para ver los cambios más recientes antes de guardar.',
          );
        }

        // Firestore rechaza el documento COMPLETO si cualquier campo llega
        // como `undefined` — no lo ignora, no lo omite, truena la escritura
        // entera. Costo/Precio/Comision personalizados son opcionales por
        // diseño (el usuario los deja en blanco casi siempre), pero antes
        // se mandaban siempre en el objeto, con valor `undefined` cuando
        // estaban vacios — eso hacia fallar el guardado de CUALQUIER
        // expediente que no llenara los tres, que es el caso mas comun.
        const datosBase: Record<string, unknown> = {
          folio: form.folio.trim(),
          client: form.client.trim(),
          clientEmail: form.clientEmail.trim(),
          department: form.department.trim(),
          provider: form.provider.trim(),
          totalKilograms: kilosNum,
          estimatedDeliveryDate: form.estimatedDeliveryDate,
          deliveries: form.deliveries,
          items: form.items,
          processedAt: order.processedAt ?? serverTimestamp(),
          isClosedShort: form.isClosedShort ?? false,
          ...camposInvoices(updatedInvoices),
        };
        if (ccp !== undefined) datosBase.customCostPrice = ccp;
        if (csp !== undefined) datosBase.customSellPrice = csp;
        if (ccr !== undefined) datosBase.customCommissionRate = ccr;
        // "Folio" y "OC" son documentos distintos (folio interno corto vs
        // numero real de Orden de Compra) — se guardan por separado, sin
        // pisarse. Solo se incluye si tiene contenido, para no repetir el
        // bug de mandar `undefined` y tronar el guardado completo.
        const ocValue = (form as any).oc?.trim?.();
        if (ocValue) datosBase.oc = ocValue;

        tx.set(ref, datosBase, { merge: true });
      });

      try {
        const { kilosEntregados } = computeDeliveredTotals(form.deliveries);
        // Si el expediente no tiene "entregas" capturadas como tal (el
        // caso de los migrados, que solo tienen kilos a nivel factura),
        // NO sobrescribir el registro de compra con 0 -- eso borraba en
        // silencio una correccion real cada vez que se guardaba CUALQUIER
        // cambio en el expediente, sin importar que tan ajeno fuera a la
        // entrega. Se usa la suma de kilos de las facturas como respaldo.
        const kilosDeFacturasParaCompra = (form.invoices || []).reduce((acc: number, i: any) => acc + (i.kilos || 0), 0);
        const kilosParaCompra = kilosEntregados > 0 ? kilosEntregados : kilosDeFacturasParaCompra;
        if (kilosParaCompra > 0) {
          await upsertAndresPurchase({
            orderId: order.id,
            // ANTES: usaba form.provider.trim() -- el nombre que aparece
            // en el documento de la OC del cliente (a veces el nombre del
            // propio negocio del usuario, como "Elemental Denim"), NO
            // quien entrega el material fisicamente. El proveedor real de
            // material (Andres) esta configurado globalmente y es ese el
            // que debe usarse aqui, sin importar que diga el expediente.
            provider: materialProviderName || form.provider.trim(),
            expectedKilos: kilosNum,
            receivedKilos: kilosParaCompra,
            costPerKg: dynamicConfig.costPricePerKg,
          });
        }
      } catch (err) {
        console.error("Error linking purchase", err);
      }

      if (form.items && form.items.length > 0) {
        try {
          await Promise.all(
            form.items.map(async (it: any) => {
              if (!it.description.trim()) return;
              const productId = it.code?.trim() 
                ? it.code.trim().toUpperCase() 
                : it.description.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
                
              await setDoc(doc(db, PATHS.products, productId), {
                code: it.code?.trim() || null,
                description: it.description.trim(),
                unit: it.unit,
                defaultPrice: it.unitPrice,
                lastOrderDate: serverTimestamp(),
              }, { merge: true });
            }),
          );
        } catch (err) {
          console.warn('No se pudo actualizar el catalogo de productos:', err);
        }
      }

      logAction(userEmail, 'Expediente Guardado', {
        orderId: order.id,
        folio: form.folio,
        kilos: kilosNum,
        facturas: updatedInvoices.length,
        cobrado: liveSummary.paidAmount,
      });
      toast('Expediente actualizado', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function removeOrder({
    order, userEmail, initialSummary, setBusy, toast, onClose
  }: any) {
    if (!window.confirm(`¿Eliminar el expediente ${order.folio ?? ''}? Esto no se puede deshacer.`))
      return;
    setBusy(true);
    try {
      await safeDeleteDoc(userEmail, doc(db, PATHS.orders, order.id), order);
      logAction(userEmail, 'Expediente Eliminado', {
        orderId: order.id,
        folio: order.folio ?? '',
        saleTotal: initialSummary.saleTotal,
        paidAmount: initialSummary.paidAmount,
      });
      toast('Expediente eliminado', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo eliminar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  // Antes no habia ninguna forma de deshacer un "Eliminar Expediente"
  // accidental desde la interfaz -- la unica opcion era editar el campo
  // isDeleted a mano en Firebase Console. Esta es la operacion inversa
  // exacta de safeDeleteDoc: quita isDeleted/deletedAt/deletedBy en vez
  // de ponerlos.
  async function restoreOrder({
    order, userEmail, setBusy, toast, onClose,
  }: any) {
    if (!window.confirm(`¿Restaurar el expediente ${order.folio ?? order.oc ?? ''}? Volverá a aparecer en todas las pantallas.`))
      return;
    setBusy(true);
    try {
      await updateDoc(doc(db, PATHS.orders, order.id), {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        deletedBy: deleteField(),
      });
      logAction(userEmail, 'Expediente Restaurado', { orderId: order.id, folio: order.folio ?? '' });
      toast('Expediente restaurado', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo restaurar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return { saveOrder, removeOrder, restoreOrder };
}
