const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
const db = admin.firestore();

async function run() {
  console.log('🚀 Iniciando aplicación canónica de OCs oficiales y archivado...');

  const batch = db.batch();

  // 1. OC TH 120267114302 (Lic. José Nava Flores)
  // 8,000 kg total @ $43.00/kg.
  // 9 partidas exactas del PDF oficial.
  // Factura 6307 real vinculada: 1,986 kg ($99,061.68 MXN con IVA), restan 6,014 kg.
  const thRef = db.collection('purchaseOrders').doc('oc-120267114302');
  const thData = {
    id: 'oc-120267114302',
    oc: '120267114302',
    folio: '71/14302',
    client: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)',
    department: 'TH-ALMACEN-1',
    costPerKg: 43.00,
    pricePerKg: 43.00,
    totalKilograms: 8000.00,
    status: 'pedido',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'pedido',
      paymentDays: 30,
    },
    items: [
      { id: 'item-1', code: 'ENBO000088-SC', description: 'BOLSA POLIETILENO 80 CM X 60 CM _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-2', code: 'EGBO000054-SC', description: 'BULTO 43+17+17x120 CM _Sin Color', quantity: 1000, deliveredQuantity: 1000, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-3', code: 'EGBO000113-SC', description: 'BULTO 48 + 17 + 17 *80 CM CAL 250 _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-4', code: 'EGBO000056-SC', description: 'BULTO 60+20+20+110 CM _Sin Color', quantity: 1000, deliveredQuantity: 986, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-5', code: 'EGBO000039-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 100 CM', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-6', code: 'EGBO000107-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-7', code: 'ENBO000167-BL', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'item-8', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', quantity: 500, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 21500 },
      { id: 'item-9', code: 'ENBO000044-SC', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 21500 },
    ],
    invoices: [
      {
        id: 'inv-6307',
        folio: '6307',
        uuid: '67F11BC8-7B33-4CFC-97EE-0AA45F51F797',
        kilos: 1986.00,
        amount: 99061.68,
        financials: {
          subtotal: 85398.00,
          iva: 13663.68,
          invoiceTotal: 99061.68,
        },
        creditCycle: {
          status: 'facturado',
          invoiceDate: '2026-09-24T10:06:29',
        },
        items: [
          { code: 'egbo000054-sc', description: 'bolsa de polietileno 43+17+17x120 CM', quantity: 1000, unitPrice: 43, amount: 43000 },
          { code: 'egbo000056-sc', description: 'bolsa de polietileno 60+20+20+110 CM', quantity: 986, unitPrice: 43, amount: 42398 }
        ],
        orderId: 'oc-120267114302',
        oc: '120267114302',
        updatedAt: admin.firestore.Timestamp.now(),
      }
    ],
    deliveries: [
      {
        id: 'del-6307',
        kilos: 1986.00,
        date: '2026-09-24',
        invoiceFolio: '6307',
        driver: 'Patio / Báscula',
        note: 'Entrega inicial parcial (1,000 kg egbo54 + 986 kg egbo56) amparada por Factura 6307',
      }
    ],
    updatedAt: admin.firestore.Timestamp.now(),
  };
  batch.set(thRef, thData, { merge: true });

  // También registrar Factura 6307 en colección /invoices
  const inv6307Ref = db.collection('invoices').doc('inv-6307');
  batch.set(inv6307Ref, {
    id: 'inv-6307',
    orderId: 'oc-120267114302',
    oc: '120267114302',
    folio: '6307',
    uuid: '67F11BC8-7B33-4CFC-97EE-0AA45F51F797',
    kilos: 1986.00,
    amount: 99061.68,
    client: 'GRUPO TEXTIL PROVIDENCIA (TH)',
    department: 'TH-ALMACEN-1',
    financials: {
      subtotal: 85398.00,
      iva: 13663.68,
      invoiceTotal: 99061.68,
    },
    creditCycle: {
      status: 'facturado',
      invoiceDate: '2026-09-24T10:06:29',
    },
    updatedAt: admin.firestore.Timestamp.now(),
    isDeleted: false,
  }, { merge: true });

  // 2. OC GT 12026439784 (Lic. Evelia)
  // 5,100 kg total @ $43.00/kg.
  // 5 partidas exactas del PDF oficial. 0 kg entregados / 5,100 kg pendientes.
  const gtRef = db.collection('purchaseOrders').doc('oc-12026439784');
  const gtData = {
    id: 'oc-12026439784',
    oc: '12026439784',
    folio: '43/9784',
    client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
    department: 'P4-ALM',
    costPerKg: 43.00,
    pricePerKg: 43.00,
    totalKilograms: 5100.00,
    status: 'pedido',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'pedido',
      paymentDays: 30,
    },
    items: [
      { id: 'gt-item-1', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 600, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 25800 },
      { id: 'gt-item-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'gt-item-3', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'gt-item-4', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1500, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 64500 },
      { id: 'gt-item-5', code: 'EGBO000094-SC', description: 'BOLSA POLIETILENO 100 X 125 CM _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
    ],
    invoices: [],
    deliveries: [],
    updatedAt: admin.firestore.Timestamp.now(),
  };
  batch.set(gtRef, gtData, { merge: true });

  // 3. ARCHIVADO FORMAL DE TODAS LAS OCS ANTERIORES CERRADAS
  // Se marcan formalmente con status: 'completed' e isClosedShort: true
  // para que el motor de seguimiento y el tablero las reconozcan como CONCLUIDAS y no las muestren en lo pendiente.
  const closedOcs = [
    'oc-12026439753',
    'oc-12026439774',
    'oc-12026439713',
    'oc-120267114114',
  ];

  for (const cid of closedOcs) {
    const docRef = db.collection('purchaseOrders').doc(cid);
    batch.set(docRef, {
      status: 'completed',
      isClosedShort: true,
      updatedAt: admin.firestore.Timestamp.now(),
    }, { merge: true });
    console.log(`📦 Marcando como concluida/archivada: ${cid}`);
  }

  // 4. Limpiar duplicados sin guion de contrarecibos legados
  const duplicateCrDocs = ['cr-gt651', 'cr-gt713', 'cr-gt742', 'cr-th879', 'cr-th912', 'cr-th946'];
  for (const crId of duplicateCrDocs) {
    const docRef = db.collection('purchaseOrders').doc(crId);
    batch.set(docRef, { isDeleted: true }, { merge: true });
  }

  await batch.commit();
  console.log('✅ Base de datos actualizada con éxito absoluto:');
  console.log('   - OC TH 120267114302: 8,000 kg total, 1,986 kg facturados (F-6307), restan 6,014 kg');
  console.log('   - OC GT 12026439784: 5,100 kg total, 0 entregados, restan 5,100 kg');
  console.log('   - OCs cerradas archivadas formalmente');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
