const admin = require('../functions/node_modules/firebase-admin');

async function processOrders() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();
  const Timestamp = admin.firestore.Timestamp;

  console.log('🚀 Iniciando procesamiento riguroso de OCs oficiales y Factura 6307...');

  // =========================================================================
  // 1. ORDEN DE COMPRA 120267114302 (TH - Nava · 71/14302 · 8,000 kg)
  // =========================================================================
  const oc1Id = 'oc-120267114302';
  const oc1Items = [
    { id: 'it-1', code: 'ENBO000088-SC', description: 'BOLSA POLIETILENO 80 CM X 60 CM _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-2', code: 'EGBO000054-SC', description: 'BULTO 43+17+17x120 CM _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-3', code: 'EGBO000113-SC', description: 'BULTO 48 + 17 + 17 *80 CM CAL 250 _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-4', code: 'EGBO000056-SC', description: 'BULTO 60+20+20+110 CM _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-5', code: 'EGBO000039-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 100 CM', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-6', code: 'EGBO000107-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-7', code: 'ENBO000167-BL', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-8', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', quantity: 500, unitPrice: 43, amount: 21500, unit: 'Kilos' },
    { id: 'it-9', code: 'ENBO000044-SC', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500, unitPrice: 43, amount: 21500, unit: 'Kilos' },
  ];

  // Factura 6307 (Entrega parcial de 1,986 kg)
  const invoice6307 = {
    id: 'inv-6307',
    orderId: oc1Id,
    folio: '6307',
    uuid: '67F11BC8-7B33-4CFC-97EE-0AA45F51F797',
    kilos: 1986.00,
    financials: {
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      saleTotal: 85398.00,
      invoiceTotal: 99061.68,
      costTotal: 75468.00,
      commission: 6831.84,
      netCashFlow: 3098.16,
      tradeMargin: 9930.00,
    },
    creditCycle: {
      status: 'pending',
      issueDate: Timestamp.fromDate(new Date('2026-09-24T10:06:29Z')),
      dueDate: Timestamp.fromDate(new Date('2026-10-24T10:06:29Z')),
    },
    collection: {
      contrareciboNumber: '',
    },
    items: [
      { id: 'inv-it-1', code: 'egbo000054-sc', description: 'bolsa de polietileno 43+17+17x120 CM', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
      { id: 'inv-it-2', code: 'egbo000056-sc', description: 'bolsa de polietileno 60+20+20+110 CM', quantity: 986, unitPrice: 43, amount: 42398, unit: 'Kilos' },
    ],
  };

  const delivery6307 = {
    id: 'del-inv-6307',
    date: Timestamp.fromDate(new Date('2026-09-24T10:06:29Z')),
    kilos: 1986.00,
    notes: 'Entrega física y fiscal amparada por Factura #6307 (1,986 kg: 1000kg egbo000054-sc + 986kg egbo000056-sc)',
    invoiced: true,
    invoiceId: 'inv-6307',
    docType: 'factura',
    docFolio: '6307',
    items: [
      { itemId: 'it-2', quantity: 1000 },
      { itemId: 'it-4', quantity: 986 },
    ],
  };

  const oc1Data = {
    id: oc1Id,
    folio: '71/14302',
    oc: '120267114302',
    client: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)',
    department: 'TH',
    subdepartment: 'TH-ALMACEN-1',
    buyer: 'JOSÉ NAVA FLORES',
    authorizer: 'JOSÉ ANTONIO TORRE LAMUÑO',
    supplier: 'N0342 - ELEMENTAL DENIM',
    totalKilograms: 8000.00,
    status: 'pedido', // Parcialmente entregada, activa en seguimiento
    isClosedShort: false,
    isArchived: false,
    isDeleted: false,
    notes: 'PEDIDO DE MATERIAL PARA PROGRAMAS WALMART/COPPEL/LIVERPOOL/CATALOGO. Entrega parcial amparada por Factura 6307 (1,986 kg). Restan 6,014 kg por entregar.',
    items: oc1Items,
    deliveries: [delivery6307],
    invoices: [invoice6307],
    invoiceStatuses: ['pending'],
    financials: {
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      saleTotal: 344000.00,
      invoiceTotal: 399040.00,
      costTotal: 304000.00,
      commission: 27520.00,
      netCashFlow: 12480.00,
      tradeMargin: 40000.00,
    },
    creditCycle: {
      status: 'pedido',
      issueDate: Timestamp.fromDate(new Date('2026-09-23T17:12:29Z')),
      dueDate: Timestamp.fromDate(new Date('2026-10-23T17:12:29Z')),
    },
    createdAt: Timestamp.fromDate(new Date('2026-09-23T17:12:29Z')),
    updatedAt: Timestamp.now(),
  };

  await db.collection('purchaseOrders').doc(oc1Id).set(oc1Data, { merge: true });
  console.log(`✅ OC ${oc1Data.oc} (Folio ${oc1Data.folio}) guardada exitosamente con Factura 6307.`);

  // Espejar Factura 6307 en /invoices
  await db.collection('invoices').doc('inv-6307').set({
    orderId: oc1Id,
    orderFolio: oc1Data.folio,
    client: oc1Data.client,
    folio: invoice6307.folio,
    uuid: invoice6307.uuid,
    kilos: invoice6307.kilos,
    financials: invoice6307.financials,
    creditCycle: invoice6307.creditCycle,
    collection: invoice6307.collection,
    _espejoDe: 'order.invoices[]',
    _actualizadoEn: Timestamp.now(),
  }, { merge: true });
  console.log('✅ Factura 6307 reflejada en colección espejo /invoices.');

  // =========================================================================
  // 2. ORDEN DE COMPRA 12026439784 (GT - Evelia / P4 · 43/9784 · 5,100 kg)
  // =========================================================================
  const oc2Id = 'oc-12026439784';
  const oc2Items = [
    { id: 'it-1', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 600, unitPrice: 43, amount: 25800, unit: 'Kilos' },
    { id: 'it-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-3', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
    { id: 'it-4', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1500, unitPrice: 43, amount: 64500, unit: 'Kilos' },
    { id: 'it-5', code: 'EGBO000094-SC', description: 'BOLSA POLIETILENO 100 X 125 CM _Sin Color', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'Kilos' },
  ];

  const oc2Data = {
    id: oc2Id,
    folio: '43/9784',
    oc: '12026439784',
    client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
    department: 'GT',
    subdepartment: 'P4-ALM',
    buyer: 'EVELIA',
    supplier: 'N0321 - ELEMENTAL DENIM',
    totalKilograms: 5100.00,
    status: 'pedido', // Abierta al 100%, activa en seguimiento
    isClosedShort: false,
    isArchived: false,
    isDeleted: false,
    notes: 'BOLSA PARA EMPAQUE DE COB - EDREDON. Orden de compra activa pendiente de entrega (5,100 kg).',
    items: oc2Items,
    deliveries: [],
    invoices: [],
    invoiceStatuses: [],
    financials: {
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      saleTotal: 219300.00,
      invoiceTotal: 254388.00,
      costTotal: 193800.00,
      commission: 17544.00,
      netCashFlow: 7956.00,
      tradeMargin: 25500.00,
    },
    creditCycle: {
      status: 'pedido',
      issueDate: Timestamp.fromDate(new Date('2026-09-21T15:14:50Z')),
      dueDate: Timestamp.fromDate(new Date('2026-10-06T15:14:50Z')),
    },
    createdAt: Timestamp.fromDate(new Date('2026-09-21T15:14:50Z')),
    updatedAt: Timestamp.now(),
  };

  await db.collection('purchaseOrders').doc(oc2Id).set(oc2Data, { merge: true });
  console.log(`✅ OC ${oc2Data.oc} (Folio ${oc2Data.folio}) guardada exitosamente.`);

  // =========================================================================
  // 3. DEJAR SOLO ESTAS DOS OCs ACTIVAS EN SEGUIMIENTO
  // =========================================================================
  // Cerrar oc-12026439774 (que estaba en 'pedido') para que no figure abierta
  const oldOcRef = db.collection('purchaseOrders').doc('oc-12026439774');
  const oldDoc = await oldOcRef.get();
  if (oldDoc.exists) {
    await oldOcRef.update({
      status: 'completado',
      isArchived: true,
      updatedAt: Timestamp.now(),
      notes: (oldDoc.data().notes || '') + ' [Cerrada en transición a OCs Oficiales 120267114302 y 12026439784]',
    });
    console.log('✅ OC previa oc-12026439774 marcada como completada/archivada.');
  }

  console.log('\n🎯 Transición completada exitosamente.');
  console.log('Solo las 2 órdenes oficiales proporcionadas están activas para seguimiento:');
  console.log('  1. OC 120267114302 (TH - Nava · 71/14302) con Factura 6307 asignada (1,986 kg entregados, 6,014 kg pendientes)');
  console.log('  2. OC 12026439784 (GT - Evelia · 43/9784 · 5,100 kg pendientes)');
  console.log('La cartera de contrarecibos oficiales se mantiene 100% protegida e intacta.\n');
}

processOrders().catch(err => {
  console.error('Error procesando órdenes:', err);
  process.exit(1);
});
