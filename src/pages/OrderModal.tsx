import { useState, useMemo } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, Timestamp, setDoc, addDoc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, PATHS, functions } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { Field, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials, configEfectiva, addDays, getOrderSummary, daysLate, round2 } from '../lib/finance';
import { escapeHtml, fromInputDate, money, toInputDate, kilos, toDate, percent } from '../lib/format';
import type { FinancialConfig, OrderStatus, PurchaseOrder, Invoice, Delivery, PurchaseOrderItem } from '../lib/types';
import { sound } from '../lib/sounds';
import { useProducts } from '../hooks/useProducts';
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
  initialTab?: 'resumen' | 'entregas' | 'facturas';
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { products } = useProducts();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'resumen' | 'productos' | 'entregas' | 'facturas'>(initialTab as any);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    oc: order.oc ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    deliveries: initialSummary.deliveries,
    invoices: initialSummary.invoices,
    items: order.items ?? [],
    customCostPrice: order.customCostPrice !== undefined ? String(order.customCostPrice) : '',
    customSellPrice: order.customSellPrice !== undefined ? String(order.customSellPrice) : '',
    customCommissionRate: order.customCommissionRate !== undefined ? String(order.customCommissionRate * 100) : '',
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

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

  const totalDeliveredKilos = useMemo(() => {
    if (form.items && form.items.length > 0) {
      return round2(form.items.reduce((sum, it) => sum + (Number(it.deliveredQuantity || it.quantity || 0)), 0));
    }
    if (form.deliveries && form.deliveries.length > 0) {
      return round2(form.deliveries.reduce((sum, d) => sum + (Number(d.kilos) || 0), 0));
    }
    return kilosNum;
  }, [form.items, form.deliveries, kilosNum]);

  const orderedKilos = kilosNum;
  const pendingKilos = useMemo(() => {
    return round2(Math.max(0, orderedKilos - totalDeliveredKilos));
  }, [orderedKilos, totalDeliveredKilos]);

  const pendingSaleValueSubtotal = useMemo(() => {
    return round2(pendingKilos * (dynamicConfig.salePricePerKg || 47));
  }, [pendingKilos, dynamicConfig.salePricePerKg]);

  const pendingSaleValueWithIVA = useMemo(() => {
    return round2(pendingSaleValueSubtotal * (1 + (dynamicConfig.ivaRate ?? 0.16)));
  }, [pendingSaleValueSubtotal, dynamicConfig.ivaRate]);

  const addDeliveredInvoice = () => {
    const issue = new Date();
    const due = addDays(issue, config.creditDays);
    const kDelivered = totalDeliveredKilos;
    
    sound.playSuccess();
    set('invoices', [
      ...form.invoices,
      { 
        id: Date.now().toString(), 
        folio: form.folio ? `FACT-${form.folio}` : 'FACT-NUEVA', 
        oc: form.folio || '',
        kilos: kDelivered, 
        creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: `Factura generada automáticamente por entrega de ${kDelivered.toLocaleString('es-MX')} kg` }
      }
    ]);
    toast(`⚡ Factura generada automáticamente por ${kDelivered.toLocaleString('es-MX')} kg entregados`, 'ok');
  };

  const renderDeliveryAlertBanner = () => {
    if (pendingKilos <= 0.01 || totalDeliveredKilos <= 0) return null;
    return (
      <div style={{
        background: 'rgba(234, 179, 8, 0.12)',
        border: '1px solid rgba(234, 179, 8, 0.4)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--ink)'
      }}>
        <div>
          <strong>⚠️ Aviso de Entrega Faltante (Tolerancia Operativa):</strong> La OC pedía <strong>{orderedKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</strong> y Andrés entregó <strong>{totalDeliveredKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</strong>.
          <br />
          Quedan <strong style={{ color: '#b45309' }}>{pendingKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg pendientes</strong> (${pendingSaleValueSubtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} subtotal neto / ${pendingSaleValueWithIVA.toLocaleString('es-MX', { minimumFractionDigits: 2 })} con IVA de venta).
        </div>
        {!readOnly && (
          <button
            className="btn"
            style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}
            onClick={addDeliveredInvoice}
          >
            ⚡ Facturar {totalDeliveredKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados
          </button>
        )}
      </div>
    );
  };

  async function save() {
    if (kilosNum <= 0) {
      sound.playError();
      toast('Los kilos totales del pedido deben ser mayores a cero.', 'bad');
      return;
    }
    const ccp = form.customCostPrice !== '' ? Number(form.customCostPrice) : undefined;
    const csp = form.customSellPrice !== '' ? Number(form.customSellPrice) : undefined;
    const ccr = form.customCommissionRate !== '' ? Number(form.customCommissionRate) : undefined;

    if ((ccp !== undefined && isNaN(ccp)) || (csp !== undefined && isNaN(csp)) || (ccr !== undefined && isNaN(ccr))) {
      sound.playError();
      toast('Por favor, ingresa solo números válidos en Costo, Precio o Comisión.', 'bad');
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

        return {
          ...inv,
          financials: computeFinancials(inv.kilos, snapshotCfg),
          collection: inv.collection ? {
            ...inv.collection,
            contrareciboNumber: inv.collection.contrareciboNumber?.trim() || ''
          } : undefined
        };
      });

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

      // Upsert Purchase for Andrés
      try {
        // Precio efectivo, NO el override opcional: `ccp` vale undefined
        // siempre que el usuario no capture un costo propio, y entonces
        // `kilosNum * ccp` daba NaN y se guardaba una compra con importe
        // invalido. dynamicConfig ya resuelve override -> configuracion base.
        const costoEfectivo = dynamicConfig.costPricePerKg;
        const purchaseRef = doc(db, PATHS.purchases, order.id);
        const purchaseSnap = await getDoc(purchaseRef);
        // La deuda se reconoce sobre lo ENTREGADO, no sobre lo pedido.
        // Decision del usuario, confirmada expresamente: Andres a veces
        // entrega sin anticipo, y la deuda debe reflejar exactamente lo que
        // ya recibiste de el -- no la OC completa desde el momento en que se
        // captura el expediente, que inflaria la deuda antes de que la
        // mercancia siquiera llegara.
        const totalAmountReal = round2(kilosEntregados * costoEfectivo);
        if (purchaseSnap.exists()) {
          await updateDoc(purchaseRef, {
            expectedKilos: kilosNum,
            receivedKilos: kilosEntregados,
            pricePerKg: costoEfectivo,
            totalAmount: totalAmountReal,
          });
        } else {
          await setDoc(purchaseRef, {
            date: serverTimestamp(),
            provider: form.provider.trim() || 'Andrés',
            expectedKilos: kilosNum,
            receivedKilos: kilosEntregados,
            pricePerKg: costoEfectivo,
            totalAmount: totalAmountReal,
            paidAmount: 0,
            status: 'pedido',
            createdAt: serverTimestamp()
          });
        }
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
    const dateStr = form.estimatedDeliveryDate ? form.estimatedDeliveryDate.toDate().toLocaleDateString() : '(por definir)';
    const subject = encodeURIComponent(`Confirmación de Entrega - Pedido #${form.folio || 'S/N'}`);
    const body = encodeURIComponent(`Estimado cliente,\n\nLe informamos que su pedido #${form.folio || 'S/N'} por la cantidad de ${kilosNum} kg tiene una fecha estimada de entrega para el ${dateStr}.\n\nSaludos,\nProvidencia`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function printRemision() {

    const html = `
      <html>
        <head>
          <title>Remisión de Entrega - ${escapeHtml(form.folio)}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; }
            h1 { border-bottom: 2px solid #000; padding-bottom: 10px; }
            .meta { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 12px; text-align: left; }
            th { background: #eee; }
            .signature { margin-top: 80px; text-align: center; width: 300px; }
            .signature div { border-top: 1px solid #000; padding-top: 8px; }
          </style>
        </head>
        <body>
          <h1>REMISIÓN DE ENTREGA</h1>
          <div class="meta">
            <div>
              <strong>Folio:</strong> ${escapeHtml(form.folio) || '(Sin folio)'}<br>
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
            <br><br><br>
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
      const k = Number(it.deliveredQuantity || it.quantity || 0);
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
          <title>Pre-Factura CFDI 4.0 - ${escapeHtml(form.folio)}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 36px; color: #1e293b; background: #fff; }
            .header { border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; color: #0284c7; font-size: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header .badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
            .box-title { font-weight: 700; color: #0f172a; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; }
            th { background: #f1f5f9; color: #334155; font-weight: 700; font-size: 12px; text-transform: uppercase; }
            .totals-container { margin-top: 24px; display: flex; justify-content: flex-end; }
            .totals-box { width: 320px; font-size: 14px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .totals-row.grand { font-size: 18px; font-weight: 800; color: #0284c7; border-top: 2px solid #0284c7; padding-top: 10px; margin-top: 6px; }
            .sat-info { margin-top: 32px; background: #fffbebf7; border: 1px solid #fef08a; border-radius: 8px; padding: 14px; font-size: 12px; color: #713f12; }
            .sat-info strong { color: #854d0e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Pre-Factura CFDI 4.0</h1>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Control Bolsas ERP · Documento Fiscal de Facturación</div>
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
            <strong>📌 Instructivo para Facturación:</strong> Documento con el desglose exacto de entregas reales de Andrés (${kilosNum.toLocaleString('es-MX')} kg). Utiliza estos valores para timbrar la factura CFDI 4.0 en el portal del SAT o en tu sistema de facturación.
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
        <head>
          <title>Paquete Consolidado - ${escapeHtml(form.client)} (OC ${escapeHtml(form.oc || '—')})</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; line-height: 1.4; }
            .header { border-bottom: 3px solid #222; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
            .header .sub { font-size: 12px; color: #555; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8f8f8; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; margin-bottom: 20px; }
            .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 4px; margin-top: 25px; margin-bottom: 10px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #eee; font-weight: 700; }
            .summary-box { background: #eef7f2; border: 1px solid #2F7A52; padding: 15px; border-radius: 6px; margin-top: 20px; }
            .summary-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .summary-line.total { border-top: 2px solid #2F7A52; font-weight: 800; font-size: 16px; color: #2F7A52; padding-top: 8px; margin-top: 6px; }
            .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-box { text-align: center; border-top: 1px solid #000; padding-top: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PAQUETE DE COBRO CONSOLIDADO</h1>
              <div class="sub">Control Bolsas ERP · Remisión + Contrarecibo + Factura</div>
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
              <strong>Proveedor Fabricante:</strong> Andrés (Sin Mermas)<br>
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

          <div class="section-title">📄 2. DETALLE DE FACTURAS Y CONTRARECIBOS (GT/TH)</div>
          <table>
            <thead>
              <tr>
                <th>Folio Factura</th>
                <th>Contrarecibo (CR)</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Facturado (con IVA)</th>
                <th style="text-align:right;">Costo Andrés</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>${invoicesHtml}</tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Ingreso Total Facturado (Venta + IVA):</span><strong>$${totalVentaConIVA.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Proveedor Andrés:</span><span style="color:#8A5A1E;">-$${totalCostoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contabilidad / Contador:</span><span style="color:#B23A2E;">-$${totalComision.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${margenPct}%):</span>
              <span>$${netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y Caja Chica</div>
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
  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
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

  // --- Handlers for Deliveries ---
  const addDelivery = () => {
    set('deliveries', [
      ...form.deliveries,
      { id: Date.now().toString(), date: Timestamp.now(), kilos: 0, notes: '' }
    ]);
  };
  const updateDelivery = (index: number, field: keyof Delivery, value: any) => {
    const next = [...form.deliveries];
    next[index] = { ...next[index], [field]: value };
    set('deliveries', next);
  };
  const removeDelivery = (index: number) => {
    if (window.confirm('¿Eliminar esta entrega?')) {
      const next = [...form.deliveries];
      next.splice(index, 1);
      set('deliveries', next);
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
      const next = [...form.invoices];
      next.splice(index, 1);
      set('invoices', next);
    }
  };

  /**
   * Suma lo ENTREGADO (deliveredQuantity) de todos los renglones y arma la
   * factura con esos kilos, en vez de que se sumen a mano fuera del sistema
   * y se transcriban. Es donde se cuela un dígito mal tecleado sin que nadie
   * se entere.
   */
  const kilosEntregados = form.items.reduce((acc, it) => acc + (Number(it.deliveredQuantity) || 0), 0);
  const kilosPedidos = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const kilosFaltantes = round2(kilosPedidos - kilosEntregados);

  function facturarLoEntregado() {
    if (kilosEntregados <= 0) {
      toast('No hay cantidades entregadas capturadas en Productos todavía.', 'bad');
      return;
    }
    const issue = new Date();
    const due = addDays(issue, config.creditDays);
    set('invoices', [
      ...form.invoices,
      {
        id: Date.now().toString(),
        folio: '',
        kilos: kilosEntregados,
        financials: computeFinancials(kilosEntregados, dynamicConfig),
        creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: '' },
      },
    ]);
    setTab('facturas');
    toast(`Factura armada con ${kilosEntregados.toLocaleString('es-MX')} kg entregados. Falta poner el folio y guardar.`, 'ok');
  }

  return (
    <Modal wide title={`Expediente ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      <datalist id="catalog-products">
        {products.map(p => (
          <option key={p.id} value={p.description} />
        ))}
      </datalist>
      
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
        {tab === 'resumen' && (
          <>
            {renderDeliveryAlertBanner()}
            <div className="form-grid">
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" defaultValue={form.folio} onBlur={(e) => set('folio', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Cliente">
                <input className="input boxed" defaultValue={form.client} onBlur={(e) => set('client', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Proveedor">
                <input className="input boxed" defaultValue={form.provider} onBlur={(e) => set('provider', e.target.value)} disabled={readOnly} />
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
                <Field label={`Costo Compra (Andrés) $/kg`}>
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
        )}

        {/* PRODUCTOS */}
        {tab === 'productos' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>Detalle de Artículos (Partidas de la OC)</h4>
                {kilosPedidos > 0 && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>
                    Entregado: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
                    {kilosFaltantes > 0.01 && (
                      <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>
                    )}
                  </p>
                )}
              </div>
              {!readOnly && kilosEntregados > 0 && (
                <button className="btn btn-primary" onClick={facturarLoEntregado}>
                  🧾 Facturar lo entregado ({kilosEntregados.toLocaleString('es-MX')} kg)
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => {
                    const text = window.prompt("Pega aquí el texto completo copiado del PDF de la OC:");
                    if (!text) return;
                    
                    const lines = text.split('\n');
                    const newItems: any[] = [];
                    
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input className="input boxed mono" type="number" step="0.01" style={{ width: 70, borderColor: (it.deliveredQuantity ?? 0) >= it.quantity && it.quantity > 0 ? 'var(--ok)' : 'var(--line)' }}
                              defaultValue={it.deliveredQuantity || ''} placeholder="0" onBlur={e => updateItem(i, 'deliveredQuantity', Number(e.target.value))} disabled={readOnly} />
                            {(it.deliveredQuantity ?? 0) >= it.quantity && it.quantity > 0 && <span style={{ fontSize: 16 }} title="Completado">✅</span>}
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
        )}

        {/* ENTREGAS */}
        {tab === 'entregas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>Registro de Entregas Parciales</h4>
              {!readOnly && <button className="btn btn-primary" onClick={addDelivery}>+ Agregar Entrega</button>}
            </div>
            {form.deliveries.length === 0 ? (
              <p className="hint">No hay entregas registradas.</p>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Kilos</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.deliveries.map((d, i) => (
                    <tr key={d.id}>
                      <td>
                        <input className="input boxed mono" type="date" 
                          defaultValue={toInputDate(d.date) || ''} 
                          onBlur={e => {
                            const date = fromInputDate(e.target.value);
                            updateDelivery(i, 'date', date ? Timestamp.fromDate(date) : null);
                          }}
                          disabled={readOnly}
                        />
                      </td>
                      <td className="num">
                        <input className="input boxed mono" type="number" step="0.01" 
                          defaultValue={d.kilos} 
                          onBlur={e => updateDelivery(i, 'kilos', Number(e.target.value))}
                          disabled={readOnly}
                        />
                      </td>
                      <td>
                        <input className="input boxed" type="text" 
                          defaultValue={d.notes || ''} 
                          onBlur={e => updateDelivery(i, 'notes', e.target.value)}
                          disabled={readOnly}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!readOnly && <button className="btn btn-danger" onClick={() => removeDelivery(i)}>X</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* FACTURAS */}
        {tab === 'facturas' && (
          <>
            {renderDeliveryAlertBanner()}
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
                  {totalDeliveredKilos > 0 && (
                    <button
                      className="btn"
                      style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }}
                      onClick={addDeliveredInvoice}
                    >
                      ⚡ Facturar {totalDeliveredKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados
                    </button>
                  )}
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
                                    toast(`💵 Recibido del contador. $${netAmount.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a Caja Chica.`, 'ok');
                                  } catch {
                                    toast('Factura marcada, pero error al registrar en Caja Chica.', 'bad');
                                  }
                                }}>
                                💵 Recibida del Contador → Caja Chica
                              </button>
                            )}
                            {inv.creditCycle.status === 'collected' && (
                              <span style={{ background: 'var(--ok)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                                ✅ Recibida y en Caja Chica
                              </span>
                            )}
                            {(inv.creditCycle.status === 'paid' || inv.creditCycle.status === 'collected') && (
                              <button className="btn" style={{ background: 'var(--line)', color: '#333', borderColor: 'var(--line)', padding: '4px 10px', fontSize: 13 }}
                                onClick={() => {
                                  if (inv.creditCycle.status === 'collected') {
                                    if (!window.confirm('Esta factura ya generó un ingreso en Caja Chica. Si deshaces el cobro, tendrás que ir a borrar el ingreso de Caja Chica manualmente. ¿Deseas continuar?')) return;
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
                            onBlur={e => updateInvoice(i, x => ({...x, folio: e.target.value}))} disabled={readOnly} />
                        </Field>
                        <Field label="Kilos Facturados">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.kilos} 
                            onBlur={e => updateInvoice(i, x => ({...x, kilos: Number(e.target.value)}))} disabled={readOnly} />
                        </Field>
                        <Field label="Contrarecibo (CR)">
                          <input className="input boxed mono" defaultValue={inv.collection?.contrareciboNumber || ''} 
                            onBlur={e => updateInvoice(i, x => ({
                              ...x, 
                              collection: { ...x.collection, contrareciboNumber: e.target.value }
                            }))} disabled={readOnly} />
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
                        <Field label="Contrarecibo">
                          <input className="input boxed mono" defaultValue={inv.collection?.contrareciboNumber || ''}
                            disabled={readOnly}
                            onBlur={e => updateInvoice(i, x => ({
                              ...x, collection: { ...x.collection, contrareciboNumber: e.target.value }
                            }))} />
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
                          <span>Factura #{inv.folio || '?'}</span>
                          <span className="mono">{money(fin.invoiceTotal)}</span>
                        </div>
                        <div className="calc-line">
                          <span>Comisión del Contador</span>
                          <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
                        </div>
                        <div className="calc-line total">
                          <span>Neto a recibir del contador</span>
                          <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - fin.commission)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
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

      <div className="modal-actions" style={{ marginTop: 16 }}>
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
