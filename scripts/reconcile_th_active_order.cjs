const admin = require('../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
}
const db = admin.firestore();

async function run() {
  console.log('🔄 Sincronizando orden activa TH 120267114302 con las 3 facturas oficiales...');

  const thRef = db.collection('purchaseOrders').doc('oc-120267114302');

  const invoices = [
    {
      id: 'inv-6307',
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
        netCashFlow: 16761.84,
        tradeMargin: 9930.00,
      },
      creditCycle: {
        status: 'facturado',
        issueDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-24T10:06:29Z')),
      },
      orderId: 'oc-120267114302',
      oc: '120267114302',
      items: [
        { code: 'egbo000054-sc', description: 'bolsa de polietileno 43+17+17x120 CM', quantity: 1000.0, unitPrice: 43.0, amount: 43000.0, unit: 'Kilos' },
        { code: 'egbo000056-sc', description: 'bolsa de polietileno 60+20+20+110 CM', quantity: 986.0, unitPrice: 43.0, amount: 42398.0, unit: 'Kilos' },
      ],
    },
    {
      id: 'inv-6334',
      folio: '6334',
      uuid: '849D6D0F-6A89-43B8-883E-148669295EBC',
      kilos: 1500.00,
      financials: {
        salePricePerKg: 43.0,
        costPricePerKg: 38.0,
        saleTotal: 64500.00,
        invoiceTotal: 74820.00,
        costTotal: 57000.00,
        commission: 5160.00,
        netCashFlow: 12660.00,
        tradeMargin: 7500.00,
      },
      creditCycle: {
        status: 'facturado',
        issueDate: admin.firestore.Timestamp.fromDate(new Date('2026-09-29T10:52:08Z')),
      },
      orderId: 'oc-120267114302',
      oc: '120267114302',
      items: [
        { code: 'ENBO000088-SC', description: 'BOLSA POLIETILENO 80 CM X 60 CM', quantity: 1000.0, unitPrice: 43.0, amount: 43000.0, unit: 'Kilos' },
        { code: 'ENBO000044-SC', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500.0, unitPrice: 43.0, amount: 21500.0, unit: 'Kilos' },
      ],
    },
    {
      id: 'inv-6363',
      folio: '6363',
      uuid: '43E53F15-865E-4FF7-A2F3-2A47AB99F8B7',
      kilos: 1500.00,
      financials: {
        salePricePerKg: 43.0,
        costPricePerKg: 38.0,
        saleTotal: 64500.00,
        invoiceTotal: 74820.00,
        costTotal: 57000.00,
        commission: 5160.00,
        netCashFlow: 12660.00,
        tradeMargin: 7500.00,
      },
      creditCycle: {
        status: 'facturado',
        issueDate: admin.firestore.Timestamp.fromDate(new Date('2026-10-06T12:12:09Z')),
      },
      orderId: 'oc-120267114302',
      oc: '120267114302',
      items: [
        { code: 'EGBO000113-SC', description: 'BULTO 48 + 17 + 17 *80 CM', quantity: 1000.0, unitPrice: 43.0, amount: 43000.0, unit: 'Kilos' },
        { code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM', quantity: 500.0, unitPrice: 43.0, amount: 21500.0, unit: 'Kilos' },
      ],
    },
  ];

  const deliveries = [
    {
      id: 'del-6307',
      date: admin.firestore.Timestamp.fromDate(new Date('2026-09-24T10:06:29Z')),
      kilos: 1986.00,
      notes: 'Entrega física amparada por Factura #6307 (1,986 kg)',
      invoiced: true,
      invoiceId: 'inv-6307',
      docType: 'factura',
      docFolio: '6307',
    },
    {
      id: 'del-6334',
      date: admin.firestore.Timestamp.fromDate(new Date('2026-09-29T10:52:08Z')),
      kilos: 1500.00,
      notes: 'Entrega física amparada por Factura #6334 (1,500 kg)',
      invoiced: true,
      invoiceId: 'inv-6334',
      docType: 'factura',
      docFolio: '6334',
    },
    {
      id: 'del-6363',
      date: admin.firestore.Timestamp.fromDate(new Date('2026-10-06T12:12:09Z')),
      kilos: 1500.00,
      notes: 'Entrega física amparada por Factura #6363 (1,500 kg)',
      invoiced: true,
      invoiceId: 'inv-6363',
      docType: 'factura',
      docFolio: '6363',
    },
  ];

  await thRef.set({
    id: 'oc-120267114302',
    oc: '120267114302',
    folio: '71/14302',
    client: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)',
    department: 'TH',
    departmentLocation: 'TH-ALMACEN-1',
    costPerKg: 38.00,
    pricePerKg: 43.00,
    totalKilograms: 8000.00,
    status: 'pedido',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'pedido',
      paymentDays: 30,
    },
    invoices,
    deliveries,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('✅ Orden oc-120267114302 actualizada con éxito:');
  console.log(`- Facturas: ${invoices.length} (Total Kilos: ${invoices.reduce((s, i) => s + i.kilos, 0)} kg, Total $: $${invoices.reduce((s, i) => s + i.financials.invoiceTotal, 0).toFixed(2)})`);
  console.log(`- Entregas: ${deliveries.length} (Total Kilos: ${deliveries.reduce((s, d) => s + d.kilos, 0)} kg)`);
  console.log(`- Kilos Faltantes de OC: ${8000 - invoices.reduce((s, i) => s + i.kilos, 0)} kg`);
}

run().catch(console.error);
