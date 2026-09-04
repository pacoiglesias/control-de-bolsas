const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({
  projectId: 'control-de-bolsas-89c88'
});
const db = getFirestore();

function normalizarTexto(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function run() {
  try {
    const configSnap = await db.collection('config').doc('financials').get();
    const cfg = configSnap.data() || {};
    
    const purchasesSnap = await db.collection('purchases').get();
    const purchases = purchasesSnap.docs.map(d => d.data());

    const expensesSnap = await db.collection('expenses').get();
    const expenses = expensesSnap.docs.map(d => d.data());

    // From useDashboardStatsV2:
    let totalPagadoAndres = 0;
    (expenses || []).forEach(e => {
      if (!e) return;
      if (normalizarTexto(e.provider) === 'andres') {
        if (e.type === 'egreso') totalPagadoAndres += Number(e.amount) || 0;
        else totalPagadoAndres -= Number(e.amount) || 0;
      }
    });

    let totalPurchasesCost = 0;
    (purchases || []).forEach(p => {
      if (!p || normalizarTexto(p.provider) !== 'andres') return;
      totalPurchasesCost += (Number(p.receivedKilos) || 0) * (p.pricePerKg || cfg.costPricePerKg || 42);
    });

    const deudaHistorica = typeof cfg.historicalDebtAndres === 'number' ? cfg.historicalDebtAndres : 82628.94;
    const deudaAndres = totalPagadoAndres - totalPurchasesCost + deudaHistorica;

    console.log("totalPagadoAndres (frontend logic):", totalPagadoAndres);
    console.log("totalPurchasesCost (frontend logic):", totalPurchasesCost);
    console.log("deudaHistorica (frontend logic):", deudaHistorica);
    console.log("deudaAndres (frontend logic):", deudaAndres);

  } catch (e) {
    console.error(e);
  }
}

run();
