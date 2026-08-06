import { collection, getDocs, writeBatch, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import type { Invoice } from './types';

export async function executeHardReset() {
  const batch = writeBatch(db);

  // 1. Archivar todas las órdenes actuales
  const ordersSnap = await getDocs(collection(db, PATHS.orders));
  ordersSnap.forEach((d) => {
    batch.update(d.ref, { isDeleted: true });
  });

  // 2. Archivar todos los expenses (Caja Chica) actuales
  const expensesSnap = await getDocs(collection(db, PATHS.expenses));
  expensesSnap.forEach((d) => {
    batch.update(d.ref, { isDeleted: true });
  });

  // 3. Crear nuevo Saldo Inicial Caja Chica ($75,270.00)
  const initialCashRef = doc(collection(db, PATHS.expenses));
  batch.set(initialCashRef, {
    amount: 75270,
    concept: 'Saldo Inicial (Corte 6 Agosto)',
    date: Timestamp.fromDate(new Date()),
    type: 'ingreso',
    category: 'Ingresos',
    createdAt: serverTimestamp(),
  });

  // 4. Crear los 10 Contrarecibos (Por Cobrar / pending)
  const contrarecibos = [
    { folio: 'TH-836', cliente: 'Textil Hogar', fecha: '2026-07-27', vencimiento: '2026-08-26', total: 106720.17 },
    { folio: 'GT-742', cliente: 'Grupo Textil', fecha: '2026-07-20', vencimiento: '2026-08-19', total: 54520.00 },
    { folio: 'TH-804', cliente: 'Textil Hogar', fecha: '2026-07-20', vencimiento: '2026-08-19', total: 136300.00 },
    { folio: 'GT-713', cliente: 'Grupo Textil', fecha: '2026-07-13', vencimiento: '2026-08-12', total: 69001.60 },
    { folio: 'TH-768', cliente: 'Textil Hogar', fecha: '2026-07-13', vencimiento: '2026-08-12', total: 125254.25 },
    { folio: 'TH-739', cliente: 'Textil Hogar', fecha: '2026-07-06', vencimiento: '2026-08-05', total: 109040.00 },
    { folio: 'GT-651', cliente: 'Grupo Textil', fecha: '2026-06-29', vencimiento: '2026-07-29', total: 106477.56 },
    { folio: 'TH-713B', cliente: 'Textil Hogar', fecha: '2026-06-29', vencimiento: '2026-07-29', total: 108647.46 }, 
    { folio: 'GT-624', cliente: 'Grupo Textil', fecha: '2026-06-22', vencimiento: '2026-07-22', total: 98136.00 },
    { folio: 'GT-597', cliente: 'Grupo Textil', fecha: '2026-06-15', vencimiento: '2026-07-15', total: 107420.76 },
  ];

  contrarecibos.forEach(cr => {
    const oRef = doc(collection(db, PATHS.orders));
    const invId = `inv_${oRef.id}`;
    const crDate = Timestamp.fromDate(new Date(`${cr.fecha}T12:00:00`));
    const vDate = Timestamp.fromDate(new Date(`${cr.vencimiento}T12:00:00`));
    
    const invoice: Invoice = {
      id: invId,
      orderId: oRef.id,
      client: cr.cliente,
      folio: cr.folio,
      financials: { invoiceTotal: cr.total, netCashFlow: cr.total, salePricePerKg: 0, costPricePerKg: 0 },
      kilos: 0,
      createdAt: Timestamp.now(),
      creditCycle: {
        status: 'pending',
        issueDate: crDate,
        dueDate: vDate,
      }
    };
    
    batch.set(oRef, {
      client: cr.cliente,
      folio: cr.folio,
      status: 'pending',
      createdAt: serverTimestamp(),
      invoices: [invoice],
    });
  });

  // 5. Crear 2 Facturas en Revisión (facturado)
  const revision = [
    { folio: '6098', cliente: 'Grupo Textil Providencia', fecha: '2026-07-27', total: 27260.00 },
    { folio: '6097', cliente: 'Grupo Textil Providencia', fecha: '2026-07-27', total: 109040.00 },
  ];
  revision.forEach(cr => {
    const oRef = doc(collection(db, PATHS.orders));
    const invId = `inv_${oRef.id}`;
    const crDate = Timestamp.fromDate(new Date(`${cr.fecha}T12:00:00`));
    
    const invoice: Invoice = {
      id: invId,
      orderId: oRef.id,
      client: cr.cliente,
      folio: cr.folio,
      financials: { invoiceTotal: cr.total, netCashFlow: cr.total, salePricePerKg: 0, costPricePerKg: 0 },
      kilos: 0,
      createdAt: Timestamp.now(),
      creditCycle: {
        status: 'facturado',
        issueDate: crDate,
      }
    };
    
    batch.set(oRef, {
      client: cr.cliente,
      folio: cr.folio,
      status: 'facturado',
      createdAt: serverTimestamp(),
      invoices: [invoice],
    });
  });

  // 6. Crear 3 Pagos Ya Cobrados (collected)
  const pagados = [
    { folio: 'TR_3640', cliente: 'Grupo Textil Providencia', fecha: '2026-07-31', total: 80970.38 },
    { folio: 'TR_3620', cliente: 'Grupo Textil Providencia', fecha: '2026-07-30', total: 196482.30 },
    { folio: 'TR_3583', cliente: 'Grupo Textil Providencia', fecha: '2026-07-27', total: 182250.55 },
  ];
  pagados.forEach(cr => {
    const oRef = doc(collection(db, PATHS.orders));
    const invId = `inv_${oRef.id}`;
    const crDate = Timestamp.fromDate(new Date(`${cr.fecha}T12:00:00`));
    
    const invoice: Invoice = {
      id: invId,
      orderId: oRef.id,
      client: cr.cliente,
      folio: cr.folio,
      financials: { invoiceTotal: cr.total, netCashFlow: cr.total, salePricePerKg: 0, costPricePerKg: 0 },
      kilos: 0,
      createdAt: Timestamp.now(),
      creditCycle: {
        status: 'collected',
        issueDate: crDate,
      }
    };
    // Poner el transferRef en collection
    invoice.collection = {
      transferRef: cr.folio,
      collectedAt: crDate
    };
    
    batch.set(oRef, {
      client: cr.cliente,
      folio: cr.folio,
      status: 'collected',
      createdAt: serverTimestamp(),
      invoices: [invoice],
    });
  });

  // 7. Crear 3 Pendientes por Facturar (pedido)
  const pendientes = [
    { kilos: 983.46, desc: 'enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM Sin Color', precio: 47, subtotal: 46222.62 },
    { kilos: 1000, desc: 'egbo000103-sc BULTO 80 X 20 +20 X 160 *250', precio: 47, subtotal: 47000 },
    { kilos: 980.7, desc: 'egbo000107-sc BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', precio: 47, subtotal: 46092.90 },
  ];
  pendientes.forEach((p, i) => {
    const oRef = doc(collection(db, PATHS.orders));
    batch.set(oRef, {
      client: 'Grupo Textil Providencia',
      folio: `PED-${i+1}`,
      status: 'pedido',
      expectedKilos: p.kilos,
      notes: `${p.desc} (OC 120267114014)`,
      createdAt: serverTimestamp(),
    });
  });

  // 8. Ajustar el saldo de Andres
  const configRef = doc(db, PATHS.config, PATHS.configFinancials);
  const comprasSnap = await getDocs(collection(db, PATHS.purchases));
  let totalPurchasesCost = 0;
  comprasSnap.forEach(snap => {
    const d = snap.data();
    if (!d.isDeleted && d.provider?.toLowerCase().includes('andr')) {
      totalPurchasesCost += (d.receivedKilos || 0) * (d.pricePerKg || 42);
    }
  });

  const newHistoricalDebt = 102670.27 + totalPurchasesCost;
  
  batch.update(configRef, {
    historicalDebtAndres: newHistoricalDebt
  });

  await batch.commit();
}
