const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
const db = admin.firestore();

async function run() {
  const kpisDoc = await db.collection('system').doc('stats').get();
  console.log("KPIS:");
  console.dir(kpisDoc.data().kpis, { depth: null });
  
  const purchasesSnap = await db.collection('purchases').get();
  let receivedKilos = 0;
  let purchasesCost = 0;
  purchasesSnap.docs.forEach(d => {
      receivedKilos += (d.data().receivedKilos || 0);
      purchasesCost += ((d.data().receivedKilos || 0) * (d.data().pricePerKg || 42));
  });
  console.log("TOTAL KILOS RECIBIDOS:", receivedKilos);
  console.log("TOTAL COMPRAS COSTO:", purchasesCost);
  
  const expensesSnap = await db.collection('expenses').get();
  let cajaChica = 0;
  let andresPagos = 0;
  expensesSnap.docs.forEach(d => {
      const e = d.data();
      if (e.category === 'proveedor') {
          if (e.type === 'egreso') andresPagos += e.amount;
          if (e.type === 'ingreso') andresPagos -= e.amount;
      } else {
          if (e.type === 'egreso') cajaChica -= e.amount;
          if (e.type === 'ingreso') cajaChica += e.amount;
      }
  });
  console.log("PAGADO A ANDRES:", andresPagos);
  console.log("CAJA CHICA:", cajaChica);
  
  // Also we need to check pending orders
  const ordersSnap = await db.collection('orders').where('status', 'in', ['pending', 'overdue', 'manual_review']).get();
  console.log("ACTIVE ORDERS COUNT:", ordersSnap.size);
  let orderFolios = [];
  ordersSnap.docs.forEach(d => orderFolios.push(d.data().folio));
  console.log("ACTIVE ORDERS:", orderFolios);
}
run();
