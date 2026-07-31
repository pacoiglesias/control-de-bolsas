import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

async function audit() {
  const purchasesSnap = await db.collection('purchases').get();
  const expensesSnap = await db.collection('expenses').get();
  
  let totalPurchases = 0;
  purchasesSnap.forEach(doc => {
    const data = doc.data();
    if (data.provider === 'Andres') {
      totalPurchases += (data.totalAmount || 0);
    }
  });

  let totalPagado = 0;
  expensesSnap.forEach(doc => {
    const data = doc.data();
    if (data.provider === 'Andres' || (data.concept && data.concept.toLowerCase().includes('andres'))) {
      if (data.type === 'egreso') totalPagado += (data.amount || 0);
      if (data.type === 'ingreso') totalPagado -= (data.amount || 0);
    }
  });

  const deudaReal = totalPurchases - totalPagado;
  
  const ordersSnap = await db.collection('purchaseOrders').get();
  let kilosPendientes = 0;
  
  ordersSnap.forEach(doc => {
    const data = doc.data();
    const totalEntregado = Number(data.totalKilograms) || 0;
    
    let facturados = 0;
    if (Array.isArray(data.invoices)) {
      data.invoices.forEach((inv: any) => {
        facturados += Number(inv.kilos) || 0;
      });
    }
    
    const faltantes = Math.max(0, totalEntregado - facturados);
    kilosPendientes += faltantes;
  });
  
  const montoPendiente = kilosPendientes * 47 * 1.16;

  console.log('--- AUDITORIA ---');
  console.log('Total Compras a Andres:', totalPurchases);
  console.log('Total Pagado a Andres:', totalPagado);
  console.log('DEUDA CON ANDRES:', deudaReal);
  console.log('-----------------');
  console.log('Kilos Pendientes de Facturar:', kilosPendientes);
  console.log('Monto Pendiente Facturar (c/ IVA):', montoPendiente);
}

audit().catch(console.error);
