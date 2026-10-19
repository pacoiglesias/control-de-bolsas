const admin = require('../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
}
const db = admin.firestore();

async function registerInvoice6392() {
  console.log('🚀 Iniciando registro perfecto de Factura CFDI 6392...');

  const orderId = 'oc-120267114302';
  const orderRef = db.collection('purchaseOrders').doc(orderId);
  const snap = await orderRef.get();

  if (!snap.exists) {
    throw new Error('No se encontró el documento de la orden ' + orderId);
  }

  const orderData = snap.data();
  console.log(`📋 Orden destino: ${orderData.folio || orderData.oc} - ${orderData.client}`);

  // Timestamps exactos de la factura
  const issueDate = admin.firestore.Timestamp.fromDate(new Date('2026-10-19T10:07:44-06:00'));
  const certDate = admin.firestore.Timestamp.fromDate(new Date('2026-10-19T10:19:32-06:00'));
  // Vencimiento a 30 días de crédito Providencia
  const dueDate = admin.firestore.Timestamp.fromDate(new Date('2026-11-18T10:07:44-06:00'));

  const invoiceId = 'prov-invoice-6392';
  const invoiceUuid = 'B3392FF2-F596-4A8A-96F3-9219BBEEC369';
  const folio = '6392';

  const invoiceItem = {
    id: 'item-6392-1',
    code: 'EGBO000107-SC',
    description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL',
    quantity: 915.00,
    deliveredQuantity: 915.00,
    unitPrice: 43.00,
    amount: 39345.00,
    unit: 'KGM',
    claveProdServ: '24141500',
    objetoImp: '02',
    tax: {
      base: 39345.00,
      impuesto: '002',
      tipoFactor: 'Tasa',
      tasaOCuota: 0.160000,
      importe: 6295.20,
    },
  };

  const financials = {
    salePricePerKg: 43.00,
    costPricePerKg: 37.00, // Maquila Textil Hogar estándar
    saleTotal: 39345.00,   // Subtotal sin IVA
    invoiceTotal: 45640.20, // Total oficial con 16% IVA
    costTotal: 33855.00,   // 915 kg * $37
    commissionRate: 0.08,  // 8% sobre subtotal Providencia
    commission: 3147.60,   // $39,345 * 0.08
    tradeMargin: 5490.00,  // $39,345 - $33,855
    netCashFlow: 8637.60,  // Margen menos comisión contador
    isEstimatedPrice: false,
    isEstimatedCost: false,
  };

  const invoiceObj = {
    id: invoiceId,
    orderId: orderId,
    oc: '120267114302',
    folio: folio,
    uuid: invoiceUuid,
    client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
    kilos: 915.00,
    items: [invoiceItem],
    financials: financials,
    creditCycle: {
      status: 'facturado',
      issueDate: issueDate,
      dueDate: dueDate,
    },
    collection: {
      contrareciboNumber: '',
      contrareciboDate: null,
      paidAmount: 0,
      paidAt: null,
      collectedAt: null,
      notes: 'Factura 6392 emitida el 19/Oct/2026 por 915.00 kg. Pendiente de ingreso a Cuentas por Pagar Textil Hogar (Ing. José Nava).',
    },
    reconciliation: {
      version: 1,
      source: 'cfdi_4_0_official_import',
      matchMethod: 'condiciones_pago_exact_oc',
      quantityBasis: 'recorded_quantity_price_total_agree',
      useSubtotalMargin: true,
      cashReceived: false,
    },
    fiscalMetadata: {
      emisorRfc: 'EDE1902136T2',
      emisorNombre: 'ELEMENTAL DENIM',
      emisorRegimen: '601 - General de Ley Personas Morales',
      receptorRfc: 'GTP930115PU1',
      receptorNombre: 'GRUPO TEXTIL PROVIDENCIA',
      receptorRegimen: '601 - General de Ley Personas Morales',
      receptorUsoCfdi: 'G01 - Adquisición de mercancías',
      condicionesPago: 'OC 120267114302',
      formaPago: '99 - Por definir',
      metodoPago: 'PPD - Pago en parcialidades o diferido',
      tipoComprobante: 'I - Ingreso',
      lugarExpedicion: '72150',
      moneda: 'MXN',
      version: '4.0',
      noCertificadoEmisor: '00001000000706670758',
      noCertificadoSat: '00001000000711762511',
      fechaEmision: '2026-10-19T10:07:44',
      fechaCertificacion: '2026-10-19T10:19:32',
      subtotal: 39345.00,
      ivaTrasladado: 6295.20,
      total: 45640.20,
    },
    isDeleted: false,
    isSuperseded: false,
    createdAt: issueDate,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  // Entrega física amparada en báscula
  const deliveryObj = {
    id: 'del-billed-6392',
    docFolio: '6392',
    docType: 'factura',
    date: issueDate,
    kilos: 915.00,
    items: [{ itemId: 'item-6392-1', quantity: 915.00 }],
    invoiced: true,
    invoiceId: invoiceId,
    invoicedKilos: 915.00,
    billingQuantityPolicy: 'truncate_each_line',
    driver: 'Andrés (Maquila Textil Hogar)',
    notes: 'Entrega física y pesaje amparado por Factura CFDI 6392 (915.00 kg - Bulto Polietileno 48x17+17x140)',
  };

  // Catálogo canónico de partidas de TH si la orden no tenía items
  const canonicalThItems = [
    { id: 'it-th-1', code: 'EGBO000107-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250 (48+17+17X140)', quantity: 2000, deliveredQuantity: 915, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
    { id: 'it-th-2', code: 'ENBO000167-BL', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco (55x126)', quantity: 1500, deliveredQuantity: 1500, unitPrice: 43.0, amount: 64500, unit: 'Kilos' },
    { id: 'it-th-3', code: 'EGBO000103-SC', description: 'BULTO 80 X 20 +20 X 160 *250 (80+20+20x160)', quantity: 1500, deliveredQuantity: 1500, unitPrice: 43.0, amount: 64500, unit: 'Kilos' },
    { id: 'it-th-4', code: 'ENBO000006-SC', description: 'BOLSA POLIETILENO 77 CM X 55 CM (55x77) _Sin Color', quantity: 2000, deliveredQuantity: 1986, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
    { id: 'it-th-5', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM (50x55) _Sin Color', quantity: 1000, deliveredQuantity: 0, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  ];

  // 1. Actualizar array de invoices en la OC
  const existingInvoices = orderData.invoices || [];
  const filteredInvoices = existingInvoices.filter(i => i.id !== invoiceId && i.folio !== folio && i.uuid !== invoiceUuid);
  const updatedInvoices = [invoiceObj, ...filteredInvoices];

  // 2. Actualizar array de deliveries en la OC
  const existingDeliveries = orderData.deliveries || [];
  const filteredDeliveries = existingDeliveries.filter(d => d.id !== deliveryObj.id && d.docFolio !== folio);
  const updatedDeliveries = [deliveryObj, ...filteredDeliveries];

  // 3. Escribir en purchaseOrders
  const updatePayload = {
    invoices: updatedInvoices,
    deliveries: updatedDeliveries,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  // Si no tenía items, asignarle los canónicos para enriquecer la orden
  if (!orderData.items || orderData.items.length === 0) {
    updatePayload.items = canonicalThItems;
  }

  await orderRef.update(updatePayload);
  console.log(`✅ Orden ${orderId} actualizada con Factura 6392 y Entrega del-billed-6392`);

  // 4. Escribir espejo en colección top-level 'invoices'
  const mirrorRef = db.collection('invoices').doc(invoiceId);
  await mirrorRef.set(invoiceObj);
  console.log(`✅ Espejo registrado en colección invoices/${invoiceId}`);

  // 5. Verificación final
  const verifySnap = await orderRef.get();
  const vData = verifySnap.data();
  const totalFacturadoKg = (vData.invoices || []).reduce((acc, i) => acc + (Number(i.kilos) || 0), 0);
  const totalFacturadoPesos = (vData.invoices || []).reduce((acc, i) => acc + (Number(i.financials?.invoiceTotal) || 0), 0);
  console.log('\n📊 RESUMEN ACTUALIZADO DE OC 120267114302 (TH - 8,000 kg):');
  console.log(`   Total Facturas: ${(vData.invoices || []).length}`);
  console.log(`   Factura nueva agregada: Folio ${folio} (UUID: ${invoiceUuid}) - ${invoiceObj.kilos} kg - $${financials.invoiceTotal.toLocaleString('es-MX')} MXN`);
  console.log(`   Kilos Totales Facturados: ${totalFacturadoKg.toLocaleString('es-MX')} kg de 8,000 kg (${((totalFacturadoKg / 8000) * 100).toFixed(1)}%)`);
  console.log(`   Monto Total Facturado: $${totalFacturadoPesos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`);
  console.log('\n🎯 Factura 6392 registrada con precisión milimétrica.');
}

registerInvoice6392().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error registrando factura 6392:', err);
  process.exit(1);
});
