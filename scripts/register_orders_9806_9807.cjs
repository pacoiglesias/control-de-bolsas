const admin = require('../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
}
const db = admin.firestore();

async function registerNewOrders() {
  console.log('🚀 Registrando Órdenes de Compra oficiales 12026439806 y 12026439807...');
  const batch = db.batch();

  // ============================================================
  // 1. OC 12026439806 (Folio 43/9806) · 2,500.00 kg @ $43.00/kg
  // Partidas:
  //   - EGBO000017-SC: 1,000 kg (1.20 M X 1.60 M) -> Remisión entregó 1,000.00 kg
  //   - EGBO000095-SC: 1,500 kg (120 X 125 CM)   -> Remisión entregó 1,478.35 kg
  // Total Remisión 6439806: 2,478.35 kg (Faltan 21.65 kg)
  // ============================================================
  const oc9806Ref = db.collection('purchaseOrders').doc('oc-12026439806');
  const oc9806Data = {
    id: 'oc-12026439806',
    oc: '12026439806',
    folio: '43/9806',
    client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV (P4 - EVELIA)',
    clientEmail: 'ecastillo@providencia.com.mx',
    department: 'P4-ALM',
    costPerKg: 43.00,
    pricePerKg: 43.00,
    totalKilograms: 2500.00,
    status: 'parcial',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'parcial',
      paymentDays: 30,
    },
    financials: {
      subtotal: 107500.00,
      iva: 17200.00,
      total: 124700.00,
    },
    items: [
      {
        id: 'item-9806-1',
        code: 'EGBO000017-SC',
        description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color',
        quantity: 1000.00,
        deliveredQuantity: 1000.00,
        unit: 'KGM',
        unitPrice: 43.00,
        amount: 43000.00,
      },
      {
        id: 'item-9806-2',
        code: 'EGBO000095-SC',
        description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color',
        quantity: 1500.00,
        deliveredQuantity: 1478.35,
        unit: 'KGM',
        unitPrice: 43.00,
        amount: 64500.00,
      },
    ],
    deliveries: [
      {
        id: 'del-6439806',
        docFolio: '6439806',
        date: '2026-10-13',
        kilos: 2478.35,
        invoiced: false,
        driver: 'Patio / Báscula Providencia (Sello 1009 Planta 4)',
        note: 'Remisión física #6439806 sellada por Evelia Castillo (13/10/2026) y Auditoría Planta 4 (Benediht Morales). Pendiente de facturar.',
        billingQuantityPolicy: 'truncate_half_kilo_each_line',
        items: [
          {
            itemId: 'item-9806-1',
            quantity: 1000.00,
            description: 'BOLSA DE POLIETILENO COLOR NATURAL 60+40X160CM C/250',
          },
          {
            itemId: 'item-9806-2',
            quantity: 1478.35,
            description: 'BOLSA DE POLIETILENO COLOR NATURAL 80+40X125CM C/250',
          },
        ],
      },
    ],
    invoices: [],
    invoiceStatuses: [],
    updatedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
  };
  batch.set(oc9806Ref, oc9806Data, { merge: true });

  // ============================================================
  // 2. OC 12026439807 (Folio 43/9807) · 3,000.00 kg @ $43.00/kg
  // Partidas:
  //   - EGBO000018-SC: 1,000 kg (1.00 M X 1.15 M) -> Remisión entregó 1,000.00 kg
  //   - EGBO000094-SC: 1,000 kg (100 X 125 CM)   -> Remisión entregó 987.00 kg
  //   - EGBO000093-SC: 1,000 kg (100 X 95 CM)    -> Remisión entregó 968.80 kg
  // Total Remisión 6439807: 2,955.80 kg (Faltan 44.20 kg)
  // ============================================================
  const oc9807Ref = db.collection('purchaseOrders').doc('oc-12026439807');
  const oc9807Data = {
    id: 'oc-12026439807',
    oc: '12026439807',
    folio: '43/9807',
    client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV (P4 - EVELIA)',
    clientEmail: 'ecastillo@providencia.com.mx',
    department: 'P4-ALM',
    costPerKg: 43.00,
    pricePerKg: 43.00,
    totalKilograms: 3000.00,
    status: 'parcial',
    isClosedShort: false,
    isDeleted: false,
    creditCycle: {
      status: 'parcial',
      paymentDays: 30,
    },
    financials: {
      subtotal: 129000.00,
      iva: 20640.00,
      total: 149640.00,
    },
    items: [
      {
        id: 'item-9807-1',
        code: 'EGBO000018-SC',
        description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color',
        quantity: 1000.00,
        deliveredQuantity: 1000.00,
        unit: 'KGM',
        unitPrice: 43.00,
        amount: 43000.00,
      },
      {
        id: 'item-9807-2',
        code: 'EGBO000094-SC',
        description: 'BOLSA POLIETILENO 100 X 125 CM _Sin Color',
        quantity: 1000.00,
        deliveredQuantity: 987.00,
        unit: 'KGM',
        unitPrice: 43.00,
        amount: 43000.00,
      },
      {
        id: 'item-9807-3',
        code: 'EGBO000093-SC',
        description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color',
        quantity: 1000.00,
        deliveredQuantity: 968.80,
        unit: 'KGM',
        unitPrice: 43.00,
        amount: 43000.00,
      },
    ],
    deliveries: [
      {
        id: 'del-6439807',
        docFolio: '6439807',
        date: '2026-10-14',
        kilos: 2955.80,
        invoiced: false,
        driver: 'Patio / Báscula Providencia (Sello 1211 Planta 4)',
        note: 'Remisión física #6439807 sellada por Evelia Castillo (14/10/2026) y Auditoría Planta 4 (Benediht Morales). Pendiente de facturar.',
        billingQuantityPolicy: 'truncate_half_kilo_each_line',
        items: [
          {
            itemId: 'item-9807-1',
            quantity: 1000.00,
            description: 'BOLSA DE POLIETILENO FUELLE COLOR NATURAL 60+40X115 CM C/250',
          },
          {
            itemId: 'item-9807-2',
            quantity: 987.00,
            description: 'BOLSA DE POLIETILENO FUELLE COLOR NATURAL 60+40X125 CM C/250',
          },
          {
            itemId: 'item-9807-3',
            quantity: 968.80,
            description: 'BOLSA DE POLIETILENO FUELLE COLOR NATURAL 60+40X95 CM C/4250',
          },
        ],
      },
    ],
    invoices: [],
    invoiceStatuses: [],
    updatedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
  };
  batch.set(oc9807Ref, oc9807Data, { merge: true });

  await batch.commit();
  console.log('✅ Ambas órdenes registradas con éxito en Firestore:');
  console.log('   - oc-12026439806: 2,500.00 kg pedidos | 2,478.35 kg entregados en Remisión 6439806 (Faltan 21.65 kg)');
  console.log('   - oc-12026439807: 3,000.00 kg pedidos | 2,955.80 kg entregados en Remisión 6439807 (Faltan 44.20 kg)');
}

registerNewOrders().catch(console.error);
