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
    const config = configSnap.exists ? configSnap.data() : {};
    console.log("=== CONFIG ==");
    console.log(config);

    const target = 'andres';

    console.log("\n=== PURCHASES ==");
    const purchasesSnap = await db.collection('purchases').get();
    let totalReceivedKilos = 0;
    let totalPurchasesCost = 0;
    let purchasesCount = 0;

    purchasesSnap.docs.forEach(d => {
      const p = d.data();
      const pProv = normalizarTexto(p.provider);
      if (pProv === target) {
        purchasesCount++;
        totalReceivedKilos += Number(p.receivedKilos) || 0;
        const cost = (Number(p.receivedKilos) || 0) * (Number(p.pricePerKg) || config.costPricePerKg || 42);
        totalPurchasesCost += cost;
        console.log(`Purchase ID: ${d.id}, Kilos: ${p.receivedKilos}, PricePerKg: ${p.pricePerKg}, Cost: ${cost}, Date: ${p.date ? p.date.toDate().toISOString().split('T')[0] : 'No Date'}`);
      } else {
        console.log(`[Skipped Purchase] ID: ${d.id}, Provider: ${p.provider}, Kilos: ${p.receivedKilos}`);
      }
    });

    console.log("\n=== EXPENSES / PAYMENTS ==");
    const expensesSnap = await db.collection('expenses').get();
    let totalPagado = 0;
    let expensesCount = 0;

    expensesSnap.docs.forEach(d => {
      const e = d.data();
      const eProv = normalizarTexto(e.provider);
      if (eProv === target) {
        expensesCount++;
        let amount = Number(e.amount) || 0;
        if (e.type === 'egreso') {
          totalPagado += amount;
        } else if (e.type === 'ingreso') {
          totalPagado -= amount;
        }
        console.log(`Expense ID: ${d.id}, Concept: "${e.concept}", Type: ${e.type}, Amount: ${amount}, Date: ${e.date ? e.date.toDate().toISOString().split('T')[0] : 'No Date'}`);
      }
    });

    console.log("\n=== SUMMARY AND CALCULATION ==");
    console.log("Purchases Count:", purchasesCount);
    console.log("Total Kilos Received:", totalReceivedKilos);
    console.log("Total Purchases Cost:", totalPurchasesCost);
    console.log("Expenses Count:", expensesCount);
    console.log("Total Pagado (Expenses):", totalPagado);
    
    const deudaHistorica = typeof config.historicalDebtAndres === 'number' ? config.historicalDebtAndres : 82628.94;
    console.log("Historical Debt (config):", config.historicalDebtAndres);
    console.log("Historical Debt (fallback/effective):", deudaHistorica);

    const saldoAndres = totalPagado - totalPurchasesCost + deudaHistorica;
    console.log("Calculated Saldo con Andrés:", saldoAndres);

  } catch (e) {
    console.error("Error executing query:", e);
  }
}

run();
