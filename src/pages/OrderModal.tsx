import { useState, useMemo, useCallback } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, Timestamp, setDoc, addDoc, runTransaction, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, PATHS, functions } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { Field, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials, configEfectiva, addDays, getOrderSummary, daysLate, round2 } from '../lib/finance';
import {
  newDeliveryEvent,
  updateDeliveryField as updateDeliveryFieldLib,
  updateDeliveryItemQuantity,
  removeDeliveryAt,
  computeDeliveredTotals,
  buildInvoiceFromDelivery,
  unmarkDeliveriesByInvoiceId,
  migrateLegacyDeliveries,
  upsertAndresPurchase,
} from '../lib/deliveries';
import { escapeHtml, fromInputDate, money, toInputDate, kilos, toDate, percent, getPrintHeaderHtml } from '../lib/format';
import { useSystemSettings } from '../hooks/useSystemSettings';
import type { FinancialConfig, OrderStatus, PurchaseOrder, Invoice, Delivery, PurchaseOrderItem } from '../lib/types';
import { sound } from '../lib/sounds';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { camposInvoices } from '../lib/invoiceOps';
import { useInvoiceParser } from '../hooks/useInvoiceParser';

export default function OrderModal({
  order,
  config,
  onClose,
  readOnly = false,
  initialTab = 'resumen',
}: {
  order: PurchaseOrder;
  config: FinancialConfig;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: 'resumen' | 'productos' | 'entregas' | 'facturas';
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { products } = useProducts();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  // useOrders() lee del mismo <OrdersProvider> ya montado en App.tsx: no abre
  // una segunda suscripcion, solo reutiliza la que ya esta viva. No existia
  // ningun catalogo de clientes ni proveedores -- a diferencia de Productos,
  // que ya tiene el suyo -- asi que se deriva de los expedientes existentes.
  const { orders: allOrders } = useOrders();
  const knownClients = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.client?.trim()) set.add(o.client.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const knownProviders = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.provider?.trim()) set.add(o.provider.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const knownClientEmails = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.clientEmail?.trim()) set.add(o.clientEmail.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'resumen' | 'productos' | 'entregas' | 'facturas'>(initialTab);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  // La migracion de entregas viejas ahora vive en lib/deliveries.ts,
  // compartida con Compras.tsx — ver migrateLegacyDeliveries.
  const migratedDeliveries = useMemo(
    () => migrateLegacyDeliveries(order, initialSummary.deliveries),
    [order, initialSummary.deliveries],
  );

  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    clientEmail: order.clientEmail ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    oc: order.oc ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    deliveries: migratedDeliveries,
    invoices: initialSummary.invoices,
    items: order.items ?? [],
    customCostPrice: order.customCostPrice !== undefined ? String(order.customCostPrice) : '',
    customSellPrice: order.customSellPrice !== undefined ? String(order.customSellPrice) : '',
    customCommissionRate: order.customCommissionRate !== undefined ? String(order.customCommissionRate * 100) : '',
  });

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v })), []);

  // Sello de tiempo del expediente al ABRIR el modal, no en cada render:
  // compararlo contra el del servidor al guardar es lo que permite detectar si
  // alguien mas toco el expediente mientras seguia abierto aqui.
  const [baselineUpdatedAt] = useState(() => order.updatedAt ?? null);

  const kilosNum = Number(form.totalKilograms) || 0;

  const fallbackCost = form.invoices[0]?.financials?.costPricePerKg ?? config.costPricePerKg;
  const fallbackSale = form.invoices[0]?.financials?.salePricePerKg ?? config.salePricePerKg;
  const fallbackComm = form.invoices[0]?.financials?.commissionRate ?? config.commissionRate;
  const csp = form.customSellPrice !== '' ? Number(form.customSellPrice) : fallbackSale;
  const ccp = form.customCostPrice !== '' ? Number(form.customCostPrice) : fallbackCost;
  const ccr = form.customCommissionRate !== '' ? Number(form.customCommissionRate) / 100 : fallbackComm;
  // Misma funcion que usa el trigger de saneamiento en el backend. Cuando
  // esto era un objeto literal aparte, la resolucion de costos variables
  // existia dos veces con dos nombres distintos y podia divergir.
  const dynamicConfig = useMemo(
    () => configEfectiva(config, { customCostPrice: ccp, customSellPrice: csp, customCommissionRate: ccr }),
    [config, ccp, csp, ccr],
  );

  // Este hook estaba dentro del bloque `{tab === 'facturas' && (() => {...})()}`,
  // es decir, solo se ejecutaba en una de las pestanas. Un hook condicional
  // rompe las Reglas de Hooks: al cambiar de pestana React ve un numero
  // distinto de hooks entre renders y revienta con "Rendered more hooks than
  // during the previous render". Va aqui arriba, incondicional, como el resto.
  const { processFacturaText, processPagoText } = useInvoiceParser({
    invoices: form.invoices,
    setInvoices: (newInvoices: Invoice[]) => set('invoices', newInvoices),
    config,
    allOrders,
  });

  const liveSummary = useMemo(() => {
    // We construct a fake order object to pass to getOrderSummary
    const tempOrder: PurchaseOrder = {
      ...order,
      folio: form.folio,
      totalKilograms: kilosNum,
      deliveries: form.deliveries,
      invoices: form.invoices,
      customCostPrice: form.customCostPrice !== '' ? Number(form.customCostPrice) : undefined,
      customSellPrice: form.customSellPrice !== '' ? Number(form.customSellPrice) : undefined,
    };
    return getOrderSummary(tempOrder);
  }, [order, form.folio, kilosNum, form.deliveries, form.invoices, form.customCostPrice, form.customSellPrice]);

  const computedInvoices = useMemo(() => {
    return form.invoices.map((inv) => {
      const baseFin = computeFinancials(inv.kilos, dynamicConfig);
      const fin = baseFin;
      const d = daysLate(toDate(inv.creditCycle.dueDate));
      const isLate = (inv.creditCycle.status === 'overdue' || inv.creditCycle.status === 'pending') && d !== null && d > 0;
      return { inv, fin, d, isLate };
    });
  }, [form.invoices, dynamicConfig]);

  // NOTA (2026-07-31): existia una segunda implementacion de "facturar lo
  // entregado" aqui (totalDeliveredKilos / addDeliveredInvoice /
  // renderDeliveryAlertBanner), construida en otra sesion sin ver la que ya
  // habia en la pestana Productos (kilosEntregados / facturarLoEntregado,
  // mas abajo en este archivo). Se retiro por dos motivos:
  //   1) BUG REAL: `it.deliveredQuantity || it.quantity || 0` trataba un
  //      renglon sin entrega capturada (0/undefined) como si se hubiera
  //      entregado COMPLETO, dejando facturar mercancia que Andres no habia
  //      entregado.
  //   2) Las dos versiones no se enteraban una de la otra: nada impedia
  //      facturar la misma entrega dos veces si el usuario usaba primero un
  //      boton y despues el otro.
  // Se conserva solo la version de la pestana Productos, que cuenta 0 cuando
  // no hay entrega capturada, sin caer al total pedido.

  async function save() {
    if (kilosNum <= 0) {
      sound.playError();
      toast('Los kilos totales del pedido deben ser mayores a cero.', 'bad');
      return;
    }
    if (!form.client.trim()) {
      sound.playError();
      toast('Falta el nombre del cliente. No se puede guardar un expediente sin él.', 'bad');
      return;
    }
    if (!form.provider.trim()) {
      sound.playError();
      toast('Falta el nombre del proveedor. No se puede guardar un expediente sin él.', 'bad');
      return;
    }
    // Aviso (no bloqueo) de folio repetido: no existia ninguna comprobacion.
    // Copiar y pegar dos veces la misma OC creaba dos expedientes identicos
    // sin que nada lo detectara. Solo avisa -- puede haber folios legitimos
    // repetidos (reenvios, correcciones) y no conviene bloquear el guardado
    // por eso.
    const folioTrim = form.folio.trim();
    if (folioTrim) {
      const duplicado = allOrders.find((o) => o.id !== order.id && (o.folio ?? '').trim() === folioTrim);
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
      sound.playError();
      toast('Por favor, ingresa solo números válidos en Costo, Precio o Comisión.', 'bad');
      return;
    }

    const { kilosEntregados: kilosEntregadosActuales } = computeDeliveredTotals(form.deliveries);
    const kilosPedidosActuales = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const tol = (dynamicConfig as any).weightTolerancePercentage ?? 2;
    const maxKilos = kilosPedidosActuales * (1 + tol / 100);
    
    if (kilosEntregadosActuales > maxKilos && kilosPedidosActuales > 0) {
      sound.playError();
      toast(`No se puede guardar: has registrado ${kilosEntregadosActuales.toLocaleString('es-MX')} kg entregados, superando el límite de tolerancia (${tol}%) sobre los ${kilosPedidosActuales.toLocaleString('es-MX')} kg pedidos (Máximo permitido: ${maxKilos.toLocaleString('es-MX')} kg).`, 'bad');
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, PATHS.orders, order.id);
      
      // Compute financials for all invoices just in case
      // Recalculate financials using historical snapshot if available to prevent history tampering
      const updatedInvoices = form.invoices.map(inv => {
        const snapshotCfg = {
          ...dynamicConfig,
          salePricePerKg: inv.financials?.salePricePerKg || config.salePricePerKg,
        };

        const crNum = inv.collection?.contrareciboNumber?.trim() || '';
        // If there's a contrarecibo but no invoice number, auto-assign S/N
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

      // --- CHECK FOR GLOBAL INVOICE DUPLICATES ---
      const qs = await getDocs(collection(db, PATHS.orders));
      for (const inv of updatedInvoices) {
        if (!inv.folio || inv.folio === 'S/N') continue;
        const upperFolio = inv.folio.toUpperCase();
        for (const doc of qs.docs) {
          if (doc.id === order.id) continue;
          const otherInvoices = doc.data().invoices || [];
          if (otherInvoices.some((x: any) => x.folio && x.folio.toUpperCase() === upperFolio)) {
            toast(`Bloqueado: El folio de factura ${inv.folio} ya está registrado en el expediente ${doc.data().folio || doc.id}.`, 'bad');
            setBusy(false);
            return;
          }
        }
      }
      // -------------------------------------------

      // El guardado completo del expediente corre en una transaccion: antes
      // era un setDoc a ciegas desde la copia local del formulario, asi que un
      // cobro registrado en Cobranza mientras este modal seguia abierto se
      // revertia en silencio al guardar aqui. La transaccion relee el
      // documento y aborta si `updatedAt` ya no coincide con lo que habia al
      // abrir el modal. camposInvoices() es la misma funcion que usa Cobranza:
      // invoices/invoiceStatuses/updatedAt viajan juntos por un solo camino.
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

      // Upsert Purchase for Andrés — delega a lib/deliveries.ts, la misma
      // funcion que usa el atajo "Registrar Entrega" de Compras.tsx.
      try {
        // Precio efectivo, NO el override opcional: `ccp` vale undefined
        // siempre que el usuario no capture un costo propio, y entonces
        // `kilosNum * ccp` daba NaN y se guardaba una compra con importe
        // invalido. dynamicConfig ya resuelve override -> configuracion base.
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

      // Alta en el catalogo de productos. Es una funcion accesoria: si falla
      // (permisos, red) NO debe tumbar el guardado del expediente, que a estas
      // alturas ya se escribio correctamente. Antes esto vivia fuera de un
      // try/catch y un solo rechazo mostraba "No se pudo guardar" sobre un
      // expediente que si se habia guardado.
      if (form.items && form.items.length > 0) {
        try {
          await Promise.all(
            form.items.map(async (it) => {
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

      logAction(user?.email, 'Expediente Guardado', {
        orderId: order.id,
        folio: form.folio,
        kilos: kilosNum,
        facturas: updatedInvoices.length,
        cobrado: liveSummary.paidAmount,
      });
      sound.playSuccess();
      toast('Expediente actualizado', 'ok');
      onClose();
    } catch (e) {
      sound.playError();
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  function emailClient() {
    const correo = form.clientEmail.trim();
    if (!correo) {
      toast('Este cliente no tiene correo capturado. Agrégalo en la pestaña Resumen para poder notificarlo.', 'bad');
      return;
    }
    const dateStr = form.estimatedDeliveryDate ? form.estimatedDeliveryDate.toDate().toLocaleDateString() : '(por definir)';
    const subject = encodeURIComponent(`Confirmación de Entrega - Pedido #${form.folio || 'S/N'}`);
    const body = encodeURIComponent(`Estimado cliente,\n\nLe informamos que su pedido #${form.folio || 'S/N'} por la cantidad de ${kilosNum} kg tiene una fecha estimada de entrega para el ${dateStr}.\n\nSaludos,\nProvidencia`);
    // Antes decia "mailto:?subject=..." — sin ningun correo antes del "?".
    // Si no habia un programa de correo configurado por defecto, el boton no
    // hacia nada visible; si lo habia, se abria con el destinatario en blanco.
    window.location.href = `mailto:${encodeURIComponent(correo)}?subject=${subject}&body=${body}`;
  }

  function printRemision() {
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Remisión de Entrega - ${escapeHtml(form.folio)}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
            th { background: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 15px; }
            .signature { margin-top: 80px; text-align: center; font-weight: 600; border-top: 1px solid #cbd5e1; padding-top: 10px; width: 300px; margin-left: auto; margin-right: auto; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Remisión de Entrega", `Folio de Expediente: ${escapeHtml(form.folio) || '(Sin folio)'}`)}
          
          <div class="grid" style="margin-top: 20px;">
            <div>
              <strong>Cliente:</strong> ${escapeHtml(form.client)}<br>
              <strong>Departamento:</strong> ${escapeHtml(form.department) || '—'}<br>
            </div>
            <div style="text-align: right;">
              <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}<br>
              <strong>Clave SAT:</strong> ${escapeHtml(config.satClaveProdServ) || '—'}<br>
              <strong>Unidad SAT:</strong> ${escapeHtml(config.satClaveUnidad) || '—'}<br>
              <strong>Método/Forma de pago:</strong> ${escapeHtml(config.satMetodoPago) || '—'} / ${escapeHtml(config.satFormaPago) || '—'}<br>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th style="text-align: right;">Cantidad (kg)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bolsa Plástica - Pedido Completo</td>
                <td style="text-align: right;">${kilosNum}</td>
              </tr>
            </tbody>
          </table>
          <div class="signature">
            <div>Nombre y Firma de Recibido</div>
          </div>
          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function printPreFactura() {
    const rawItems = form.items && form.items.length > 0 ? form.items : [];
    
    const itemsList = rawItems.length > 0 ? rawItems.map(it => {
      const k = Number(deliveredByItem[it.id] ?? it.deliveredQuantity ?? it.quantity ?? 0);
      const price = Number(it.unitPrice || dynamicConfig.salePricePerKg || 47);
      const subtotal = round2(k * price);
      return {
        code: it.code || 'Bolsa',
        desc: it.description || 'Bolsa Polietileno',
        kilos: k,
        price,
        subtotal
      };
    }) : [{
      code: 'Bolsa',
      desc: 'Bolsa Polietileno',
      kilos: kilosNum,
      price: dynamicConfig.salePricePerKg || 47,
      subtotal: round2(kilosNum * (dynamicConfig.salePricePerKg || 47))
    }];

    const subtotalTotal = round2(itemsList.reduce((sum, item) => sum + item.subtotal, 0));
    const ivaTotal = round2(subtotalTotal * (dynamicConfig.ivaRate ?? 0.16));
    const grandTotal = round2(subtotalTotal + ivaTotal);

    const itemsRows = itemsList.map(it => `
      <tr>
        <td style="text-align: right; font-weight: 600;">${it.kilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td><strong>${escapeHtml(it.code)}</strong> - ${escapeHtml(it.desc)}</td>
        <td style="text-align: right;">$${it.price.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">$${it.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Pre-Factura CFDI 4.0 - ${escapeHtml(form.folio)}</title>
          <style>
            .header-subtitle { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .header-meta { text-align: right; color: #475569; }
            .header-meta strong { color: #0f172a; display: block; margin-bottom: 4px; font-size: 14px; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .badge-ok { background: #dcfce7; color: #166534; }
            .badge-warn { background: #fef9c3; color: #854d0e; }
            .badge-bad { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Pre-Factura CFDI 4.0</h1>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Bolsas Elemental ERP · Documento Fiscal de Facturación</div>
            </div>
            <div class="badge">ORDEN / NOTA: ${escapeHtml(form.folio) || '120267114014'}</div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="box-title">DATOS DEL RECEPTOR</div>
              <strong>GRUPO TEXTIL PROVIDENCIA SA DE CV</strong><br>
              <strong>RFC:</strong> GTP930115PU1<br>
              <strong>Domicilio Fiscal:</strong> HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO<br>
              <strong>Uso CFDI:</strong> G01 - Adquisición de mercancías
            </div>
            <div class="box">
              <div class="box-title">ESPECIFICACIONES CFDI 4.0 / METADATOS</div>
              <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
              <strong>Método de Pago:</strong> PPD (Pago en parcialidades o diferido)<br>
              <strong>Forma de Pago:</strong> 99 Por definir<br>
              <strong>Clave Prod/Serv SAT:</strong> 24141500 (Bolsas de plástico)<br>
              <strong>Clave Unidad SAT:</strong> KGM (Kilogramos)<br>
              <strong>Nota en CFDI:</strong> OC ${escapeHtml(form.folio) || '120267114014'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%; text-align: right;">Kilos</th>
                <th style="width: 50%;">Descripción / Código Producto</th>
                <th style="width: 15%; text-align: right;">Precio ($/kg)</th>
                <th style="width: 20%; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-box">
              <div class="totals-row">
                <span>SUBTOTAL:</span>
                <strong>$${subtotalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="totals-row">
                <span>IVA (16%):</span>
                <strong>$${ivaTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="totals-row grand">
                <span>TOTAL:</span>
                <span>$${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div class="sat-info">
            <strong>📌 Instructivo para Facturación:</strong> Documento con el desglose exacto de entregas reales de ${provName} (${kilosNum.toLocaleString('es-MX')} kg). Utiliza estos valores para timbrar la factura CFDI 4.0 en el portal del SAT o en tu sistema de facturación.
          </div>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function printConsolidatedPackage() {

    const totalKilos = Number(form.totalKilograms) || 0;
    const invList = form.invoices ?? [];
    const delList = form.deliveries ?? [];

    let totalVentaConIVA = 0;
    let totalCostoAndres = 0;
    let totalComision = 0;

    const invoicesHtml = invList.map(inv => {
      const baseFin = computeFinancials(inv.kilos, config);
      const customComm = inv.financials?.commission;
      const invTotal = baseFin.invoiceTotal;
      const costAndres = baseFin.costTotal;
      const comm = customComm ?? baseFin.commission;
      const net = invTotal - comm - costAndres;

      totalVentaConIVA += invTotal;
      totalCostoAndres += costAndres;
      totalComision += comm;

      return `
        <tr>
          <td style="font-family:monospace;font-weight:600;">#${escapeHtml(inv.folio || '—')}</td>
          <td style="font-family:monospace;">${escapeHtml(inv.collection?.contrareciboNumber || '—')}</td>
          <td style="text-align:right;">${inv.kilos.toLocaleString('es-MX')} kg</td>
          <td style="text-align:right;">$${invTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#8A5A1E;">-$${costAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#B23A2E;">-$${comm.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;font-weight:700;color:#2F7A52;">$${net.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
        </tr>
      `;
    }).join('');

    const deliveriesHtml = delList.map(d => `
      <tr>
        <td>${d.date ? toDate(d.date)?.toLocaleDateString('es-MX') || '—' : '—'}</td>
        <td style="text-align:right;">${d.kilos.toLocaleString('es-MX')} kg</td>
        <td>${escapeHtml(d.notes || '—')}</td>
      </tr>
    `).join('');

    const netUtilidad = totalVentaConIVA - totalCostoAndres - totalComision;
    const margenPct = totalVentaConIVA > 0 ? ((netUtilidad / totalVentaConIVA) * 100).toFixed(2) : '0.00';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>\n          <meta charset="UTF-8">
          <title>Paquete Consolidado - ${escapeHtml(form.client)} (OC ${escapeHtml(form.oc || '—')})</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; background: #fff; }
            .header { border-bottom: 4px solid #0f172a; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
            .header-brand { display: flex; flex-direction: column; gap: 4px; }
            .header h1 { margin: 0; font-size: 26px; color: #0f172a; letter-spacing: -0.02em; font-weight: 800; }
            .header-subtitle { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .header-meta { text-align: right; color: #475569; }
            .header-meta strong { color: #0f172a; display: block; margin-bottom: 4px; font-size: 14px; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .badge-ok { background: #dcfce7; color: #166534; }
            .badge-warn { background: #fef9c3; color: #854d0e; }
            .badge-bad { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PAQUETE DE COBRO CONSOLIDADO</h1>
              <div class="sub">Bolsas Elemental ERP · Pre-Factura CFDI</div>
            </div>
            <div style="text-align:right;">
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}<br>
              <strong>Folio Expediente:</strong> #${escapeHtml(form.folio || '—')}
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <strong>Cliente:</strong> ${escapeHtml(form.client || '—')}<br>
              <strong>Departamento:</strong> ${escapeHtml(form.department || '—')}<br>
              <strong>Orden de Compra (OC):</strong> ${escapeHtml(form.oc || '—')}
            </div>
            <div style="text-align:right;">
              <strong>Proveedor Fabricante:</strong> ${provName} (Sin Mermas)<br>
              <strong>Kilos Totales:</strong> ${totalKilos.toLocaleString('es-MX')} kg<br>
              <strong>Facturas Asociadas:</strong> ${invList.length}
            </div>
          </div>

          ${delList.length > 0 ? `
            <div class="section-title">📦 1. REMISIONES Y ENTREGAS DE PLÁSTICO</div>
            <table>
              <thead>
                <tr>
                  <th>Fecha Entrega</th>
                  <th style="text-align:right;">Kilos Entregados</th>
                  <th>Notas / Remisión</th>
                </tr>
              </thead>
              <tbody>${deliveriesHtml}</tbody>
            </table>
          ` : ''}

          <div class="section-title">📄 2. DETALLE DE FACTURAS (CFDI) Y CONTRARECIBOS (GT/TH)</div>
          <table>
            <thead>
              <tr>
                <th>Folio Factura</th>
                <th>Contrarecibo (CR)</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Facturado (con IVA)</th>
                <th style="text-align:right;">Costo ${provName}</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>${invoicesHtml}</tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Ingreso Total Facturado (Venta + IVA):</span><strong>$${totalVentaConIVA.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Proveedor ${provName}:</span><span style="color:#8A5A1E;">-$${totalCostoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contabilidad / Contador:</span><span style="color:#B23A2E;">-$${totalComision.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${margenPct}%):</span>
              <span>$${netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y CAJA</div>
          </div>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el expediente ${order.folio ?? ''}? Esto no se puede deshacer.`))
      return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, PATHS.orders, order.id));
      logAction(user?.email, 'Expediente Eliminado', {
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


  function parseOCAndFill() {
    const text = prompt('Pega aquí el texto completo copiado de la Orden de Compra (OC):');
    if (!text) return;

    const folioMatch = text.match(/CDB OC:\s*([\w]+)/i) || text.match(/No\.\s*Ord\.\s*de\s*Compra:\s*([^\s\n\r]+)/i);
    const folio = folioMatch ? folioMatch[1].trim() : '';

    const isProvidencia = text.match(/PROVIDENCIA/i);
    const client = isProvidencia ? 'GRUPO TEXTIL PROVIDENCIA SA DE CV' : '';

    // Buscar líneas de artículos que típicamente terminan en "1,000.0000 47.0000 0.0000 47,000.0000"
    // Extracting the first number in that sequence (Quantity)
    const itemsMatch = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s+[\d,]+(?:\.\d+)?\s+[\d,]+(?:\.\d+)?\s+[\d,]+(?:\.\d+)?/g)];
    let kilos = 0;
    if (itemsMatch.length > 0) {
      itemsMatch.forEach(m => kilos += Number(m[1].replace(/,/g, '')));
    } else {
      // Fallback: look for lines starting with number and having "BOLSA" or "BULTO"
      const altMatch = text.match(/(?:BOLSA|BULTO)[^\n\r]*?([\d,]+(?:\.\d+)?)/i);
      if (altMatch) kilos = Number(altMatch[1].replace(/,/g, ''));
    }

    setForm(f => ({
      ...f,
      folio: folio || f.folio,
      client: client || f.client,
      totalKilograms: kilos > 0 ? kilos.toString() : f.totalKilograms,
      provider: provName
    }));

    toast(`OC procesada. Folio: ${folio || '?'}, Kilos: ${kilos > 0 ? kilos : '?'}`, 'ok');
  }

  async function retryAI() {
    setBusy(true);
    try {
      // Las funciones viven en us-east1 (ver lib/firebase.ts). Crear aqui una
      // instancia sin region la mandaba a us-central1: fallaba siempre.
      const reprocess = httpsCallable(functions, 'reprocessOrder');
      await reprocess({ orderId: order.id });
      toast('Archivo reenviado a la IA exitosamente.', 'ok');
      onClose();
    } catch (e) {
      toast(`Error al reintentar: ${(e as Error).message}`, 'bad');
      setBusy(false);
    }
  }

  // --- Handlers for Items ---
  const addItem = () => {
    set('items', [
      ...form.items,
      { id: Date.now().toString(), quantity: 0, unit: 'Kilos', description: '', unitPrice: config.salePricePerKg, amount: 0 }
    ]);
  };
  const updateItem = <F extends keyof PurchaseOrderItem>(index: number, field: F, value: PurchaseOrderItem[F]) => {
    const next = [...form.items];
    next[index] = { ...next[index], [field]: value };
    
    // Auto-fill from catalog if description matches exactly
    if (field === 'description') {
      const matchedProd = products.find(p => p.description === value);
      if (matchedProd) {
        next[index].code = matchedProd.code || '';
        next[index].unit = matchedProd.unit;
        next[index].unitPrice = matchedProd.defaultPrice;
      }
    }
    
    // Auto-fill from catalog if code matches exactly
    if (field === 'code' && value) {
      const matchedProd = products.find(p => p.code?.toUpperCase() === String(value).toUpperCase() || p.id === String(value).toUpperCase());
      if (matchedProd) {
        next[index].description = matchedProd.description;
        next[index].unit = matchedProd.unit;
        next[index].unitPrice = matchedProd.defaultPrice;
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'description') {
      next[index].amount = Number((next[index].quantity * next[index].unitPrice).toFixed(2));
    }
    set('items', next);
  };
  const removeItem = (index: number) => {
    if (window.confirm('¿Eliminar este artículo?')) {
      const next = [...form.items];
      next.splice(index, 1);
      set('items', next);
    }
  };

  // --- Handlers for Deliveries (delegan a lib/deliveries.ts) ---
  const addDelivery = () => {
    set('deliveries', [...form.deliveries, newDeliveryEvent(form.items)]);
  };
  const updateDelivery = <F extends keyof Delivery>(index: number, field: F, value: Delivery[F]) => {
    set('deliveries', updateDeliveryFieldLib(form.deliveries, index, field, value));
  };
  const updateDeliveryItemQty = (deliveryIndex: number, itemId: string, quantity: number) => {
    set('deliveries', updateDeliveryItemQuantity(form.deliveries, deliveryIndex, itemId, quantity));
  };
  const removeDelivery = (index: number) => {
    const result = removeDeliveryAt(form.deliveries, index);
    if ('error' in result) {
      toast(result.error, 'bad');
      return;
    }
    if (window.confirm('¿Eliminar esta entrega?')) {
      set('deliveries', result.deliveries);
    }
  };

  // --- Handlers for Invoices ---
  const addInvoice = () => {
    const issue = new Date();
    const due = addDays(issue, config.creditDays);
    set('invoices', [
      ...form.invoices,
      { 
        id: Date.now().toString(), 
        folio: '', 
        kilos: 0, 
        creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: '' }
      }
    ]);
  };
  const updateInvoice = (index: number, updateFn: (inv: Invoice) => Invoice) => {
    const next = [...form.invoices];
    next[index] = updateFn(next[index]);
    set('invoices', next);
  };
  const removeInvoice = (index: number) => {
    if (window.confirm('¿Eliminar esta factura?')) {
      const invoiceId = form.invoices[index]?.id;
      const nextInvoices = [...form.invoices];
      nextInvoices.splice(index, 1);
      // Si esta factura vino de una entrega, esa entrega vuelve a quedar
      // "pendiente de facturar" en vez de quedar bloqueada para siempre.
      const nextDeliveries = unmarkDeliveriesByInvoiceId(form.deliveries, invoiceId);
      setForm((f) => ({ ...f, invoices: nextInvoices, deliveries: nextDeliveries }));
    }
  };

  // Lo entregado se deriva de los EVENTOS de entrega (form.deliveries), via
  // lib/deliveries.ts — la misma fuente que usa Compras.tsx.
  const { deliveredByItem, kilosEntregados } = useMemo(
    () => computeDeliveredTotals(form.deliveries),
    [form.deliveries],
  );
  const kilosPedidos = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const kilosFaltantes = round2(kilosPedidos - kilosEntregados);

  /**
   * Factura UNA entrega especifica, no el acumulado — ver Ciclo 26 en
   * AUDIT_NOTEBOOK.md. La logica vive en lib/deliveries.ts; aqui solo se
   * conecta al estado del formulario y al toast.
   */
  function facturarEntrega(deliveryIndex: number) {
    const delivery = form.deliveries[deliveryIndex];
    if (!delivery) return;
    const result = buildInvoiceFromDelivery(delivery, dynamicConfig);
    if ('error' in result) {
      toast(result.error, 'bad');
      return;
    }
    const nextDeliveries = [...form.deliveries];
    nextDeliveries[deliveryIndex] = result.updatedDelivery;
    setForm((f) => ({ ...f, invoices: [...f.invoices, result.invoice], deliveries: nextDeliveries }));
    setTab('facturas');
    toast(`Factura armada con ${result.kilos.toLocaleString('es-MX')} kg de esta entrega. Falta poner el folio y guardar.`, 'ok');
  }



  const resumenTabJSX = useMemo(() => (
    <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn" onClick={parseOCAndFill} style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)', fontWeight: 600 }}>
                📋 Pegar Texto de OC (Autollenado)
              </button>
            </div>
            <div className="form-grid">
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" defaultValue={form.folio} onBlur={(e) => set('folio', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Cliente">
                <input className="input boxed" list="known-clients" defaultValue={form.client} onBlur={(e) => set('client', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Correo del cliente (opcional)">
                <input className="input boxed" type="email" list="known-client-emails" placeholder="correo@cliente.com"
                  defaultValue={form.clientEmail} onBlur={(e) => set('clientEmail', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Proveedor">
                <input className="input boxed" list="known-providers" defaultValue={form.provider} onBlur={(e) => set('provider', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Kilos Pedidos (Total)">
                <input className="input boxed mono" type="number" step="0.01" defaultValue={form.totalKilograms}
                  onBlur={(e) => set('totalKilograms', e.target.value)} disabled={readOnly} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Field label="Fecha Promesa de Entrega">
                  <input className="input boxed mono" type="date" 
                    value={toInputDate(form.estimatedDeliveryDate) || ''}
                    onChange={(e) => {
                      const d = fromInputDate(e.target.value);
                      set('estimatedDeliveryDate', d ? Timestamp.fromDate(d) : null);
                    }} 
                    disabled={readOnly} 
                  />
                </Field>
                <button className="btn" onClick={emailClient} style={{ background: 'var(--info)', color: '#fff', borderColor: 'var(--info)' }}>✉️ Notificar al cliente</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Field label={`Precio Venta Acordado $/kg`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customSellPrice', e.target.value)} defaultValue={form.customSellPrice} disabled={readOnly} placeholder={`Ej. ${fallbackSale}`} />
                </Field>
                <Field label={`Costo Compra (${provName}) $/kg`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customCostPrice', e.target.value)} defaultValue={form.customCostPrice} disabled={readOnly} placeholder={`Ej. ${fallbackCost}`} />
                </Field>
                <Field label={`Comisión Contabilidad %`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customCommissionRate', e.target.value)} defaultValue={form.customCommissionRate} disabled={readOnly} placeholder={`Ej. ${fallbackComm * 100}`} />
                </Field>
              </div>
            </div>

            <h4 style={{ marginTop: 24, marginBottom: 12 }}>Estado Global</h4>
            <div className="calc-box">
              <div className="calc-line">
                <span>Kilos Pedidos</span>
                <span className="mono">{kilos(kilosNum)}</span>
              </div>
              <div className="calc-line">
                <span>Kilos Entregados</span>
                <span className="mono" style={{ color: liveSummary.kilosDelivered < kilosNum ? 'var(--warn)' : 'var(--ok)' }}>
                  {kilos(liveSummary.kilosDelivered)}
                </span>
              </div>
              <div className="calc-line">
                <span>Kilos Pendientes</span>
                <span className="mono" style={{ color: kilosNum - liveSummary.kilosDelivered > 0 ? 'var(--bad)' : 'inherit' }}>
                  {kilosNum - liveSummary.kilosDelivered > 0 ? kilos(kilosNum - liveSummary.kilosDelivered) : '0'}
                </span>
              </div>
              <div className="calc-line">
                <span>Kilos Facturados</span>
                <span className="mono">{kilos(liveSummary.kilosInvoiced)}</span>
              </div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
              <div className="calc-line">
                <span>Venta Total (Sin IVA)</span>
                <span className="mono">{money(liveSummary.saleTotal)}</span>
              </div>
              <div className="calc-line">
                <span>Total Facturado (Con IVA)</span>
                <span className="mono">{money(liveSummary.invoiceTotal)}</span>
              </div>
              <div className="calc-line">
                <span>Cobrado</span>
                <span className="mono">{money(liveSummary.paidAmount)}</span>
              </div>
              <div className="calc-line total">
                <span>Deuda Restante</span>
                <span className="mono" style={{ color: liveSummary.invoiceTotal - liveSummary.paidAmount > 0 ? 'var(--bad)' : 'inherit' }}>
                  {money(liveSummary.invoiceTotal - liveSummary.paidAmount)}
                </span>
              </div>
              
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
              
              <div className="calc-line">
                <span>Ganancia Comercial (Devengada)</span>
                {form.customCostPrice && form.customSellPrice ? (
                  <span className="mono" style={{ color: 'var(--ok)' }}>{money(liveSummary.tradeMargin)}</span>
                ) : (
                  <span className="mono" style={{ color: 'var(--warn)', fontSize: '0.85em' }}>Falta costo/venta</span>
                )}
              </div>
              <div className="calc-line">
                <span>Ganancia por Cobros (Realizada)</span>
                <span className="mono" style={{ color: liveSummary.realizedProfit > 0 ? 'var(--ok)' : 'inherit' }}>
                  {money(liveSummary.realizedProfit)}
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
            </div>
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [form.folio, form.client, form.clientEmail, form.department, form.provider, form.oc, form.totalKilograms, form.estimatedDeliveryDate, form.customCostPrice, form.customSellPrice, form.customCommissionRate, liveSummary.status, readOnly, fallbackCost, fallbackSale, fallbackComm]);

  const productosTabJSX = useMemo(() => (
    <>
            {kilosEntregados > 0 && form.deliveries.some((d) => !d.invoiced) && (
              <div className="alert warn" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)' }}>
                <strong>📝 Hay una entrega sin facturar.</strong> Ve a la pestaña <strong>Entregas</strong> para
                revisar las cantidades y presionar "Facturar esta entrega".
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>Detalle de Artículos (Partidas de la OC)</h4>
                {kilosPedidos > 0 && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>
                    Entregado: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
                    {kilosFaltantes > 0.01 && (
                      <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>
                    )}
                    {' · '}se captura en la pestaña <strong>Entregas</strong>.
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => {
                    const text = window.prompt("Pega aquí el texto completo copiado del PDF de la OC:");
                    if (!text) return;
                    
                    const lines = text.split('\n');
                    const newItems: PurchaseOrderItem[] = [];
                    
                    for (const line of lines) {
                      const numsMatch = line.match(/(.*?)\s+((?:[\d,]+\.\d{2,4}\s*)+)$/);
                      if (numsMatch) {
                        const rawDesc = numsMatch[1].trim();
                        const nums = numsMatch[2].trim().split(/\s+/).map(n => Number(n.replace(/,/g, '')));
                        
                        if (nums.length >= 3 && !rawDesc.toLowerCase().includes('subtotal') && !rawDesc.toLowerCase().includes('total')) {
                          let code = '';
                          let cleanDesc = rawDesc;
                          const parts = cleanDesc.split(/\s+/);
                          if (/^\d+$/.test(parts[0])) {
                            parts.shift(); // Remove leading row number
                          }
                          // Check if first word looks like a product code (letters+numbers or hyphens, >4 chars)
                          if (parts.length > 1 && /^[a-zA-Z0-9-]{5,}$/.test(parts[0])) {
                            code = parts.shift() || '';
                          }
                          cleanDesc = parts.join(' ');

                          newItems.push({
                            id: Date.now().toString() + Math.random().toString().slice(2, 6),
                            code: code,
                            description: cleanDesc,
                            quantity: nums[0],
                            unitPrice: nums[1],
                            amount: nums[nums.length - 1],
                            unit: 'Kilos'
                          });
                        }
                      }
                    }

                    let newFolio = form.folio;
                    let newProvider = form.provider;
                    let newClient = form.client;

                    const folioMatch = text.match(/No\.?\s*Ord(?:en)?\.?\s*de\s*Compra:\s*([^\n]+)/i);
                    const folio2 = text.match(/CDB OC:\s*([^\n]+)/i);
                    if (!newFolio) {
                      if (folioMatch) newFolio = folioMatch[1].trim();
                      else if (folio2) newFolio = folio2[1].trim();
                    }

                    const providerMatch = text.match(/Proveedor\s*\n\s*([^\n]+)/i);
                    if (!newProvider && providerMatch) {
                      newProvider = providerMatch[1].trim();
                    }

                    if (!newClient && lines.length > 0) {
                      const firstLine = lines[0].split('|')[0].trim();
                      if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.includes(':')) {
                         newClient = firstLine;
                      }
                    }

                    if (newItems.length > 0 || newFolio !== form.folio) {
                      setForm(f => ({
                        ...f,
                        folio: newFolio,
                        provider: newProvider,
                        client: newClient,
                        items: [...f.items, ...newItems],
                        totalKilograms: newItems.length > 0 ? String(newItems.reduce((acc, it) => acc + (it.quantity || 0), 0)) : f.totalKilograms
                      }));
                      toast(`Detectado: ${newItems.length} artículos, Folio: ${newFolio || 'N/A'}.`, 'ok');
                    } else {
                      toast('No se detectó ningún artículo ni folio. Revisa el texto pegado.', 'bad');
                    }
                  }} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }}>📋 Pegar Texto OC</button>
                  <button className="btn btn-primary" onClick={addItem}>+ Agregar Artículo</button>
                </div>
              )}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">No hay artículos detallados. La IA extrae estos datos automáticamente del PDF de la Orden de Compra.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th className="num">Cant. Pedida</th>
                      <th className="num">Cant. Entregada</th>
                      <th>Unidad</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th className="num">P. Unitario</th>
                      <th className="num">Importe</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, i) => (
                      <tr key={it.id}>
                        <td className="num">
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 70 }}
                            defaultValue={it.quantity} onBlur={e => updateItem(i, 'quantity', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {/* Solo lectura: se captura en la pestaña Entregas, no aquí. Antes
                                este campo era editable y era la mitad del sistema duplicado que
                                no se enteraba de la pestaña Entregas. */}
                            <span className="mono" title="Se captura en la pestaña Entregas">
                              {(deliveredByItem[it.id] ?? 0).toLocaleString('es-MX')}
                            </span>
                            {(deliveredByItem[it.id] ?? 0) >= it.quantity && it.quantity > 0 && <span style={{ fontSize: 16 }} title="Completado">✅</span>}
                          </div>
                        </td>
                        <td>
                          <input className="input boxed" type="text" style={{ width: 70 }}
                            defaultValue={it.unit} onBlur={e => updateItem(i, 'unit', e.target.value)} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed mono" type="text" style={{ width: 100 }} placeholder="Opcional"
                            defaultValue={it.code || ''} onBlur={e => updateItem(i, 'code', e.target.value)} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed" type="text" list="catalog-products" style={{ minWidth: 200 }}
                            defaultValue={it.description} onBlur={e => updateItem(i, 'description', e.target.value)} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 80 }}
                            defaultValue={it.unitPrice} onBlur={e => updateItem(i, 'unitPrice', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num mono" style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                          {money(it.amount)}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          {!readOnly && <button className="btn btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Suma Importes:</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>
                        {money(form.items.reduce((acc, it) => acc + it.amount, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [form.items, form.folio, form.provider, form.client, form.deliveries, kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem, readOnly]);

  const entregasTabJSX = useMemo(() => (
    <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h4 style={{ margin: 0 }}>Registro de Entregas</h4>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  Cada vez que {provName} entrega, se captura como un evento con fecha y cantidades por producto.
                  Entregado en total: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
                  {kilosFaltantes > 0.01 && <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>}
                </p>
              </div>
              {!readOnly && form.items.length > 0 && <button className="btn btn-primary" onClick={addDelivery}>+ Nueva Entrega</button>}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">Captura primero los productos de la OC en la pestaña Productos.</p>
            ) : form.deliveries.length === 0 ? (
              <p className="hint">No hay entregas registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.deliveries.map((d, i) => {
                  const kilosDeEsta = round2((d.items ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0) || d.kilos || 0);
                  return (
                    <div key={d.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <input className="input boxed mono" type="date"
                            defaultValue={toInputDate(d.date) || ''}
                            onBlur={e => {
                              const date = fromInputDate(e.target.value);
                              updateDelivery(i, 'date', date ? Timestamp.fromDate(date) : null);
                            }}
                            disabled={readOnly || d.invoiced}
                          />
                          {d.invoiced ? (
                            <span className="badge badge-ok">✅ Facturada</span>
                          ) : (
                            <span className="badge badge-warn">📝 Pendiente de facturar</span>
                          )}
                          <strong className="mono">{kilosDeEsta.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!readOnly && !d.invoiced && kilosDeEsta > 0 && (
                            <button className="btn btn-primary" onClick={() => facturarEntrega(i)}>🧾 Facturar esta entrega</button>
                          )}
                          {!readOnly && !d.invoiced && (
                            <button className="btn btn-danger" onClick={() => removeDelivery(i)}>Eliminar</button>
                          )}
                        </div>
                      </div>
                      <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr><th>Producto</th><th className="num">Pedido</th><th className="num">Entregado (esta vez)</th></tr>
                        </thead>
                        <tbody>
                          {form.items.map((it) => {
                            const qtyEnEsta = (d.items ?? []).find((x) => x.itemId === it.id)?.quantity ?? 0;
                            return (
                              <tr key={it.id}>
                                <td>{it.description || it.code || '(sin descripción)'}</td>
                                <td className="num mono">{it.quantity.toLocaleString('es-MX')}</td>
                                <td className="num">
                                  <input className="input boxed mono" type="number" step="0.01" style={{ width: 90 }}
                                    defaultValue={qtyEnEsta}
                                    onBlur={e => updateDeliveryItemQty(i, it.id, Number(e.target.value))}
                                    disabled={readOnly || d.invoiced}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <input className="input boxed" type="text" style={{ width: '100%', marginTop: 8 }}
                        placeholder="Notas de esta entrega (opcional)"
                        defaultValue={d.notes || ''}
                        onBlur={e => updateDelivery(i, 'notes', e.target.value)}
                        disabled={readOnly || d.invoiced}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [form.deliveries, kilosPedidos, form.items, readOnly]);

  const facturasTabJSX = useMemo(() => (
    <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Facturas Emitidas</h3>
                <p className="hint" style={{ margin: 0 }}>Facturas vinculadas a este pedido.</p>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => {
                    const text = window.prompt("Pega aquí el texto completo copiado del PDF o XML de la Factura:");
                    if (text) processFacturaText(text);
                  }} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }}>📋 PEGAR FACTURA</button>

                  <button className="btn" onClick={() => {
                    const text = window.prompt("Pega aquí el texto completo copiado del PDF del Complemento de Pago:");
                    if (text) processPagoText(text);
                  }} style={{ background: 'var(--bg-card)', border: '1px dashed var(--ok)', color: 'var(--ok)' }}>💰 PEGAR COMPLEMENTO</button>

                  <button className="btn btn-primary" onClick={addInvoice}>+ Manual</button>
                </div>
              )}
            </div>
            {form.invoices.length === 0 ? (
              <p className="hint">No hay facturas registradas. Si la IA detecta que este PDF es una factura, la agregará aquí automáticamente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {computedInvoices.map(({ inv, fin, d, isLate }, i) => {
                  
                  return (
                    <div key={inv.id} className="card" style={{ padding: 16, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <strong>Factura {inv.folio ? `#${inv.folio}` : '(sin folio)'}</strong>
                        {!readOnly && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {inv.creditCycle.status !== 'paid' && inv.creditCycle.status !== 'collected' && (
                              <button className="btn" style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', padding: '4px 10px', fontSize: 13 }}
                                onClick={() => {
                                  sound.playCash();
                                  const invTotal = fin.invoiceTotal;
                                  updateInvoice(i, x => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'paid' },
                                    collection: { ...x.collection, paidAmount: invTotal, paidAt: Timestamp.now() }
                                  }));
                                  toast('✅ Marcada como cobrada por el cliente. Pendiente de recibir del contador.', 'ok');
                                }}>
                                💰 Cobrada por Cliente
                              </button>
                            )}
                            {inv.creditCycle.status === 'paid' && (
                              <button className="btn" style={{ background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)', padding: '4px 10px', fontSize: 13 }}
                                onClick={async () => {
                                  sound.playCash();
                                  const invTotal = fin.invoiceTotal;
                                  const commission = fin.commission;
                                  const netAmount = invTotal - commission;
                                  // 1. Actualizar estado de la factura
                                  updateInvoice(i, x => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'collected' },
                                    collection: { ...x.collection, collectedAt: Timestamp.now() }
                                  }));
                                  // 2. Crear ingreso automático en Caja Chica
                                  try {
                                    await addDoc(collection(db, PATHS.expenses), {
                                      date: Timestamp.now(),
                                      concept: `Cobro factura #${inv.folio ?? '?'} (CR: ${inv.collection?.contrareciboNumber ?? '—'})`,
                                      amount: netAmount,
                                      type: 'ingreso',
                                      notes: `Factura: $${(invTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${(commission ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
                                      createdAt: serverTimestamp(),
                                    });
                                    toast(`💵 Recibido del contador. $${netAmount.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA.`, 'ok');
                                  } catch {
                                    toast('Factura marcada, pero error al registrar en CAJA.', 'bad');
                                  }
                                }}>
                                💵 Recibida del Contador → CAJA
                              </button>
                            )}
                            {inv.creditCycle.status === 'collected' && (
                              <span style={{ background: 'var(--ok)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                                ✅ Recibida y en CAJA
                              </span>
                            )}
                            {(inv.creditCycle.status === 'paid' || inv.creditCycle.status === 'collected') && (
                              <button className="btn" style={{ background: 'var(--line)', color: '#333', borderColor: 'var(--line)', padding: '4px 10px', fontSize: 13 }}
                                onClick={() => {
                                  if (inv.creditCycle.status === 'collected') {
                                    if (!window.confirm('Esta factura ya generó un ingreso en CAJA. Si deshaces el cobro, tendrás que ir a borrar el ingreso de CAJA manualmente. ¿Deseas continuar?')) return;
                                  } else {
                                    if (!window.confirm('¿Deshacer el cobro de esta factura? Volverá a estar pendiente de cobro.')) return;
                                  }
                                  updateInvoice(i, x => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'pending' },
                                    collection: { ...x.collection, paidAmount: 0, paidAt: null, collectedAt: null }
                                  }));
                                  toast('Cobro deshecho. No olvides Guardar el expediente.', 'ok');
                                }}>
                                ↩️ Deshacer Cobro
                              </button>
                            )}
                            <button className="btn btn-danger" onClick={() => removeInvoice(i)}>Eliminar</button>
                          </div>
                        )}
                      </div>
                      <div className="form-grid">
                        <Field label="Folio">
                          <input className="input boxed mono" defaultValue={inv.folio || ''} 
                            onBlur={e => {
                              const val = e.target.value.trim().toUpperCase();
                              if (val.startsWith('GT') || val.startsWith('TH')) {
                                toast('Error: TH y GT son exclusivas de Contrarecibo. Ingresa un número de factura válido.', 'bad');
                                e.target.value = inv.folio || '';
                                return;
                              }
                              updateInvoice(i, x => ({...x, folio: e.target.value}));
                            }} disabled={readOnly} />
                        </Field>
                        <Field label="Kilos Facturados">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.kilos} 
                            onBlur={e => updateInvoice(i, x => ({...x, kilos: Number(e.target.value)}))} disabled={readOnly} />
                        </Field>
                        <Field label="Contrarecibo (CR)">
                          <input className="input boxed mono" defaultValue={inv.collection?.contrareciboNumber || ''} 
                            disabled={readOnly}
                            onBlur={e => {
                              let val = e.target.value.trim().toUpperCase();
                              if (val) {
                                if (val.startsWith('TH-') || val.startsWith('GT-')) val = val.substring(3);
                                val = `${order.department || 'TH'}-${val}`;
                              }
                              e.target.value = val;
                              updateInvoice(i, x => ({
                                ...x, 
                                collection: { ...x.collection, contrareciboNumber: val }
                              }));
                            }} />
                        </Field>
                        <Field label="Vencimiento (Promesa)">
                          <input className="input boxed mono" type="date" 
                            value={toInputDate(inv.creditCycle.dueDate) || ''} 
                            onChange={e => {
                              const d = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x,
                                creditCycle: { ...x.creditCycle, dueDate: d ? Timestamp.fromDate(d) : null }
                              }));
                            }} disabled={readOnly} />
                        </Field>
                        <Field label="Estado">
                          <select className="input boxed" value={inv.creditCycle.status}
                            disabled={readOnly}
                            onChange={(e) => updateInvoice(i, x => ({
                              ...x, 
                              creditCycle: { ...x.creditCycle, status: e.target.value as OrderStatus }
                            }))}>
                            <option value="pending">Por cobrar</option>
                              <option value="paid">🟡 Con el contador</option>
                              <option value="collected">✅ Recibida</option>
                              <option value="overdue">Vencida</option>
                              <option value="manual_review">Revisión manual</option>
                          </select>
                          <div style={{ color: 'var(--bad)', fontWeight: 'bold', fontSize: '12px', marginTop: 4, minHeight: 18, visibility: isLate ? 'visible' : 'hidden' }}>
                            {isLate ? `⚠️ ${d} días de atraso` : ' '}
                          </div>
                        </Field>
                        <Field label="Emisión">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.creditCycle.issueDate) || ''}
                            disabled={readOnly}
                            onChange={(e) => {
                              const issue = fromInputDate(e.target.value);
                              if (issue) {
                                const due = addDays(issue, config.creditDays);
                                updateInvoice(i, x => ({
                                  ...x, 
                                  creditCycle: { 
                                    ...x.creditCycle, 
                                    issueDate: Timestamp.fromDate(issue),
                                    dueDate: Timestamp.fromDate(due)
                                  }
                                }));
                              }
                            }} />
                        </Field>
                        <Field label="Vence">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.creditCycle.dueDate) || ''}
                            disabled={readOnly}
                            onChange={(e) => {
                              const due = fromInputDate(e.target.value);
                              if (due) {
                                updateInvoice(i, x => ({
                                  ...x, 
                                  creditCycle: { ...x.creditCycle, dueDate: Timestamp.fromDate(due) }
                                }));
                              }
                            }} />
                        </Field>
                        <Field label="Fecha Contrarecibo">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.contrareciboDate) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const cd = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x, collection: { ...x.collection, contrareciboDate: cd ? Timestamp.fromDate(cd) : null }
                              }))
                            }} />
                        </Field>
                        <Field label="Monto Cobrado">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.collection?.paidAmount || 0}
                            disabled={readOnly}
                            onBlur={e => updateInvoice(i, x => ({
                              ...x, collection: { ...x.collection, paidAmount: Number(e.target.value) }
                            }))} />
                        </Field>
                        <Field label="Fecha de Cobro">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.paidAt) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const pa = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x, collection: { ...x.collection, paidAt: pa ? Timestamp.fromDate(pa) : null }
                              }))
                            }} />
                        </Field>
                        <Field label="Comisión Contador ($)">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.financials?.commission ?? fin.commission}
                            disabled={readOnly}
                            onBlur={e => {
                              const val = Number(e.target.value);
                              updateInvoice(i, x => ({
                                ...x,
                                financials: {
                                  ...(x.financials ?? fin),
                                  commission: val,
                                }
                              }));
                            }} />
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                            {inv.financials?.commission !== undefined ? '⚠️ Comisión personalizada para esta factura' : `Auto: ${percent(config.commissionRate)} s/subtotal`}
                          </div>
                        </Field>
                        {(inv.creditCycle.status === 'paid' || inv.creditCycle.status === 'collected') && (
                          <Field label="Complemento de Pago (SAT)">
                            <select
                              className="input boxed"
                              disabled={readOnly}
                              value={inv.collection?.complementStatus ?? 'pending'}
                              onChange={e => updateInvoice(i, x => ({
                                ...x, collection: { ...x.collection, complementStatus: e.target.value as 'pending' | 'issued' | 'na' }
                              }))}
                            >
                              <option value="pending">⏳ Pendiente de emitir</option>
                              <option value="issued">✅ Emitido y enviado</option>
                              <option value="na">— No aplica</option>
                            </select>
                            {inv.collection?.complementStatus === 'pending' && (
                              <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4, fontWeight: 600 }}>
                                ⚠️ Recuerda emitir el complemento de pago al SAT y enviarlo al cliente.
                              </div>
                            )}
                            {inv.collection?.complementStatus === 'issued' && (
                              <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 4, fontWeight: 600 }}>
                                ✅ Complemento emitido y enviado al cliente.
                              </div>
                            )}
                          </Field>
                        )}
                      </div>
                      <div className="calc-box" style={{ marginTop: 12 }}>
                        <div className="calc-line">
                          <span>Venta (Total Factura)</span>
                          <span className="mono">{money(fin.invoiceTotal)}</span>
                        </div>
                        <div className="calc-line">
                          <span>Costo de Compra (Kilos a ${provName})</span>
                          <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.costTotal)}</span>
                        </div>
                        <div className="calc-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
                          <strong>Utilidad Bruta</strong>
                          <strong className="mono">{money(fin.invoiceTotal - fin.costTotal)}</strong>
                        </div>
                        <div className="calc-line">
                          <span>Comisión del Contador</span>
                          <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
                        </div>
                        <div className="calc-line total" style={{ borderTop: '2px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
                          <span>💰 UTILIDAD NETA (Ganancia Real)</span>
                          <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - fin.costTotal - fin.commission)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [form.invoices, computedInvoices, config, readOnly]);

  // Viability logic
  const estimatedTotalCost = form.items.length > 0 
    ? form.items.reduce((acc, it) => acc + ((Number(it.quantity) || 0) * ccp), 0) 
    : kilosNum * ccp;
  const cajaBalance = settings?.cajaChicaBalance || 0;
  const viabilityWarning = estimatedTotalCost > cajaBalance;

  return (
    <Modal wide title={`Expediente ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      <datalist id="catalog-products">
        {products.map(p => (
          <option key={p.id} value={p.description} />
        ))}
      </datalist>
      <datalist id="known-clients">
        {knownClients.map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="known-providers">
        {knownProviders.map(p => <option key={p} value={p} />)}
      </datalist>
      <datalist id="known-client-emails">
        {knownClientEmails.map(e => <option key={e} value={e} />)}
      </datalist>

      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: viabilityWarning ? 'var(--warn-bg)' : 'var(--ok-bg)', border: `1px solid ${viabilityWarning ? 'var(--warn)' : 'var(--ok)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>{viabilityWarning ? '⚠️' : '✅'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Auditoría de Viabilidad (Caja Chica vs Costo Producción)</div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            Saldo actual en Caja Chica: <strong>{money(cajaBalance)}</strong> &middot; Costo de Producción estimado: <strong>{money(estimatedTotalCost)}</strong>.
            {viabilityWarning ? ' El saldo no es suficiente para cubrir esta orden por completo.' : ' Hay saldo suficiente para esta orden.'}
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        <button className={`btn ${tab === 'resumen' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('resumen'); }}>Resumen</button>
        <button className={`btn ${tab === 'productos' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('productos'); }}>
          Productos <span className="badge">{form.items.length}</span>
        </button>
        <button className={`btn ${tab === 'entregas' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('entregas'); }}>
          Entregas <span className="badge">{form.deliveries.length}</span>
        </button>
        <button className={`btn ${tab === 'facturas' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('facturas'); }}>
          Facturas <span className="badge">{form.invoices.length}</span>
        </button>
        <button className="btn" style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printConsolidatedPackage}>
          🖨️ Paquete Consolidado (PDF)
        </button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ minHeight: '50vh', maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        
        {/* RESUMEN */}
        {tab === 'resumen' && resumenTabJSX}

        {/* PRODUCTOS */}
        {tab === 'productos' && productosTabJSX}

        {/* ENTREGAS */}
        {tab === 'entregas' && entregasTabJSX}

        {/* FACTURAS */}
        {tab === 'facturas' && facturasTabJSX}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          Archivo original: <code>{order.fileName ?? '—'}</code>
        </p>
        {order.aiError && !readOnly && (
          <button className="btn btn-primary" style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => void retryAI()} disabled={busy}>
            🤖 Reintentar IA
          </button>
        )}
      </div>

      <div className="modal-actions" style={{ marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--bg-modal)', padding: '16px 0', borderTop: '1px solid var(--line)', zIndex: 10 }}>
        {!readOnly && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
            {busy ? <span className="spinner" style={{ marginRight: 8 }}></span> : '🗑️ '} Eliminar Expediente
          </button>
        )}
        <button className="btn" onClick={printRemision} style={{ marginLeft: 12 }}>📄 Generar Remisión (PDF)</button>
        <button className="btn" onClick={printPreFactura} style={{ marginLeft: 12, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }}>📋 Pre-Factura CFDI 4.0 (PDF)</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>
    </Modal>
  );
}
