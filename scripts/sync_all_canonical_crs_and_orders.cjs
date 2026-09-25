const admin = require('../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
}
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

async function syncAll() {
  console.log('🚀 Iniciando sincronización canónica y definitiva de Cartera Providencia y OCs activas...');
  const batch = db.batch();

  // 1. REHABILITAR OCS ACTIVAS (Eliminar isDeleted: true)
  // -------------------------------------------------------------
  // OC TH Activa: 120267114302 (71/14302 - 8,000 kg - F-6307 por 1,986 kg en revisión sin CR)
  const thRef = db.collection('purchaseOrders').doc('oc-120267114302');
  batch.set(thRef, {
    id: 'oc-120267114302',
    oc: '120267114302',
    folio: '71/14302',
    client: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)',
    department: 'TH',
    costPerKg: 38.00,
    pricePerKg: 43.00,
    totalKilograms: 8000.00,
    status: 'pedido',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'pending',
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
        financials: {
          salePricePerKg: 43.00,
          costPricePerKg: 38.00,
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
          contrareciboNumber: '', // En revisión en apps.mundoprovidencia.com
        },
        orderId: 'oc-120267114302',
        oc: '120267114302',
      }
    ],
    deliveries: [
      {
        id: 'del-6307',
        kilos: 1986.00,
        date: Timestamp.fromDate(new Date('2026-09-24T10:06:29Z')),
        notes: 'Entrega en planta amparada por Factura #6307 (1,986 kg)',
        invoiced: true,
        invoiceId: 'inv-6307',
        docType: 'factura',
        docFolio: '6307',
      }
    ],
    updatedAt: Timestamp.now(),
  }, { merge: true });

  // OC GT Activa: 12026439784 (43/9784 - 5,100 kg)
  const gtRef = db.collection('purchaseOrders').doc('oc-12026439784');
  batch.set(gtRef, {
    id: 'oc-12026439784',
    oc: '12026439784',
    folio: '43/9784',
    client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
    department: 'GT',
    costPerKg: 38.00,
    pricePerKg: 43.00,
    totalKilograms: 5100.00,
    status: 'pedido',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'pending',
      paymentDays: 30,
    },
    items: [
      { id: 'gt-item-1', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 600, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 25800 },
      { id: 'gt-item-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'gt-item-3', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
      { id: 'gt-item-4', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1500, deliveredQuantity: 0, unit: 'KGM', unitPrice: 64500, amount: 64500 },
      { id: 'gt-item-5', code: 'EGBO000094-SC', description: 'BOLSA POLIETILENO 100 X 125 CM _Sin Color', quantity: 1000, deliveredQuantity: 0, unit: 'KGM', unitPrice: 43, amount: 43000 },
    ],
    invoices: [],
    deliveries: [],
    updatedAt: Timestamp.now(),
  }, { merge: true });

  // OC GT 12026439774 (Factura 6302 por 298 kg en revisión sin CR)
  const gt774Ref = db.collection('purchaseOrders').doc('oc-12026439774');
  batch.set(gt774Ref, {
    id: 'oc-12026439774',
    oc: '12026439774',
    folio: '43/9774',
    client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
    department: 'GT',
    isDeleted: false,
    invoices: [
      {
        id: 'inv-6302',
        folio: '6302',
        uuid: 'FFD7964A-BD1E-4332-AEA9-61E3F498521C',
        kilos: 298.00,
        financials: {
          salePricePerKg: 43.00,
          costPricePerKg: 38.00,
          saleTotal: 12814.00,
          invoiceTotal: 14864.24,
          costTotal: 11324.00,
          commission: 1025.12,
          netCashFlow: 465.12,
          tradeMargin: 1490.00,
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.fromDate(new Date('2026-09-22T00:00:00Z')),
        },
        collection: {
          contrareciboNumber: '', // En revisión en apps.mundoprovidencia.com
        },
        orderId: 'oc-12026439774',
        oc: '12026439774',
      }
    ],
    updatedAt: Timestamp.now(),
  }, { merge: true });

  // 2. SINCRONIZAR LOS 10 CONTRARECIBOS OFICIALES VIGENTES ($805,190.14)
  // -------------------------------------------------------------
  const crDefs = [
    {
      docId: 'cr-gt993',
      cr: 'GT-993',
      dept: 'GT',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      monto: 110434.32,
      issueDate: '2026-09-21',
      dueDate: '2026-10-21',
      invoices: [
        { folio: '6284', kilos: 1107.00, total: 55217.16 },
        { folio: '6285', kilos: 1107.00, total: 55217.16 },
      ]
    },
    {
      docId: 'cr-gt962',
      cr: 'GT-962',
      dept: 'GT',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      monto: 110783.48,
      issueDate: '2026-09-14',
      dueDate: '2026-10-14',
      invoices: [
        { folio: '6275', kilos: 1110.50, total: 55391.74 },
        { folio: '6276', kilos: 1110.50, total: 55391.74 },
      ]
    },
    {
      docId: 'cr-th1103',
      cr: 'TH-1103',
      dept: 'TH',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      monto: 74820.00,
      issueDate: '2026-09-14',
      dueDate: '2026-10-14',
      invoices: [
        { folio: '6271', kilos: 1500.00, total: 74820.00 },
      ]
    },
    {
      docId: 'cr-gt929',
      cr: 'GT-929',
      dept: 'GT',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      monto: 83499.12,
      issueDate: '2026-09-07',
      dueDate: '2026-10-07',
      invoices: [
        { folio: '6267', kilos: 837.00, total: 41749.56 },
        { folio: '6268', kilos: 837.00, total: 41749.56 },
      ]
    },
    {
      docId: 'cr-th1068',
      cr: 'TH-1068',
      dept: 'TH',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      monto: 72086.58,
      issueDate: '2026-09-07',
      dueDate: '2026-10-07',
      invoices: [
        { folio: '6266', kilos: 1445.20, total: 72086.58 },
      ]
    },
    {
      docId: 'cr-gt904',
      cr: 'GT-904',
      dept: 'GT',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      monto: 49032.04,
      issueDate: '2026-08-31',
      dueDate: '2026-09-30',
      invoices: [
        { folio: '6224', kilos: 983.00, total: 49032.04 },
      ]
    },
    {
      docId: 'cr-th1030',
      cr: 'TH-1030',
      dept: 'TH',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      monto: 74820.00,
      issueDate: '2026-08-31',
      dueDate: '2026-09-30',
      invoices: [
        { folio: '6200', kilos: 1500.00, total: 74820.00 },
      ]
    },
    {
      docId: 'cr-gt874',
      cr: 'GT-874',
      dept: 'GT',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      monto: 49880.00,
      issueDate: '2026-08-24',
      dueDate: '2026-09-23',
      invoices: [
        { folio: '6193', kilos: 1000.00, total: 49880.00 },
      ]
    },
    {
      docId: 'cr-th990',
      cr: 'TH-990',
      dept: 'TH',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      monto: 98054.60,
      issueDate: '2026-08-24',
      dueDate: '2026-09-23',
      invoices: [
        { folio: '6198', kilos: 1965.81, total: 98054.60 },
      ]
    },
    {
      docId: 'cr-th946',
      cr: 'TH-946',
      dept: 'TH',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      monto: 81780.00,
      issueDate: '2026-08-17',
      dueDate: '2026-09-16', // VENCIDO
      invoices: [
        { folio: '6167', kilos: 1639.55, total: 81780.00 },
      ]
    },
  ];

  for (const cr of crDefs) {
    const docRef = db.collection('purchaseOrders').doc(cr.docId);
    const invoiceObjects = cr.invoices.map(inv => ({
      id: `inv-${cr.cr.toLowerCase()}-${inv.folio}`,
      orderId: cr.docId,
      oc: cr.cr,
      folio: inv.folio,
      kilos: inv.kilos,
      financials: {
        salePricePerKg: 43.00,
        costPricePerKg: 38.00,
        saleTotal: inv.kilos * 43.00,
        invoiceTotal: inv.total,
        costTotal: inv.kilos * 38.00,
        commission: (inv.kilos * 43.00) * 0.08,
        netCashFlow: inv.total - (inv.kilos * 38.00) - ((inv.kilos * 43.00) * 0.08),
        tradeMargin: (inv.kilos * 43.00) - (inv.kilos * 38.00),
      },
      creditCycle: {
        status: 'pending',
        issueDate: Timestamp.fromDate(new Date(`${cr.issueDate}T12:00:00Z`)),
        dueDate: Timestamp.fromDate(new Date(`${cr.dueDate}T12:00:00Z`)),
      },
      collection: {
        contrareciboNumber: cr.cr,
        contrareciboDate: Timestamp.fromDate(new Date(`${cr.issueDate}T12:00:00Z`)),
        paidAmount: 0,
      },
    }));

    const deliveries = cr.invoices.map(inv => ({
      id: `del-${cr.cr.toLowerCase()}-${inv.folio}`,
      kilos: inv.kilos,
      date: Timestamp.fromDate(new Date(`${cr.issueDate}T12:00:00Z`)),
      notes: `Entrega amparada con Factura #${inv.folio} y Contrarecibo ${cr.cr}`,
      invoiced: true,
      invoiceId: `inv-${cr.cr.toLowerCase()}-${inv.folio}`,
      docType: 'factura',
      docFolio: inv.folio,
    }));

    const totalKilos = cr.invoices.reduce((s, i) => s + i.kilos, 0);

    batch.set(docRef, {
      id: cr.docId,
      oc: cr.cr,
      folio: cr.cr,
      client: cr.client,
      department: cr.dept,
      costPerKg: 38.00,
      pricePerKg: 43.00,
      totalKilograms: totalKilos,
      status: 'pending',
      isClosedShort: false,
      isDeleted: false,
      collection: {
        contrareciboNumber: cr.cr,
        contrareciboDate: Timestamp.fromDate(new Date(`${cr.issueDate}T12:00:00Z`)),
      },
      creditCycle: {
        status: 'pending',
        issueDate: Timestamp.fromDate(new Date(`${cr.issueDate}T12:00:00Z`)),
        dueDate: Timestamp.fromDate(new Date(`${cr.dueDate}T12:00:00Z`)),
      },
      invoices: invoiceObjects,
      deliveries: deliveries,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log(`✅ Sincronizado documento canónico de Contrarecibo: ${cr.cr} ($${cr.monto.toLocaleString('es-MX')})`);
  }

  await batch.commit();
  console.log('🎉 Sincronización a Firestore completada exitosamente.');
}

syncAll().catch(console.error);
