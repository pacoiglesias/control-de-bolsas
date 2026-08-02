import { doc, setDoc, getDocs, collection, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PATHS } from '../../lib/firebase';
import { Invoice } from '../../lib/types';
import { computeFinancials } from '../../lib/finance';
import { camposInvoices } from '../../lib/invoiceOps';
import { computeDeliveredTotals, upsertAndresPurchase } from '../../lib/deliveries';
import { safeDeleteDoc, logAction } from '../../lib/logger';

export function useOrderActions() {
  async function saveOrder({
    form, order, kilosNum, allOrders, dynamicConfig, config, baselineUpdatedAt, userEmail, toast, setBusy, onClose, liveSummary
  }: any) {
    if (kilosNum <= 0) {
      toast('Los kilos totales del pedido deben ser mayores a cero.', 'bad');
      return;
    }
    if (!form.client.trim()) {
      toast('Falta el nombre del cliente. No se puede guardar un expediente sin él.', 'bad');
      return;
    }
    if (!form.provider.trim()) {
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
          salePricePerKg: inv.financials?.salePricePerKg || config.salePricePerKg,
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
        if (!snap.exists()) throw new Error('El expediente ya no existe.');

        const freshUpdatedAt = (snap.data().updatedAt as Timestamp | undefined) ?? null;
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

        tx.set(ref, {
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
          customCostPrice: ccp,
          customSellPrice: csp,
          customCommissionRate: ccr,
          ...camposInvoices(updatedInvoices),
        }, { merge: true });
      });

      try {
        const { kilosEntregados } = computeDeliveredTotals(form.deliveries);
        await upsertAndresPurchase({
          orderId: order.id,
          provider: form.provider.trim(),
          expectedKilos: kilosNum,
          receivedKilos: kilosEntregados,
          costPerKg: dynamicConfig.costPricePerKg,
        });
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

  return { saveOrder, removeOrder };
}
