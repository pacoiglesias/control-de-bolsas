const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/pacoi/Downloads/CONTROL  FACTURAS PROVIDENCIA/functions/serviceAccountKey.json', 'utf8'));

try {
  initializeApp({ credential: cert(serviceAccount) });
} catch (e) {}

const db = getFirestore();

async function check() {
  const snap = await db.collection('purchaseOrders').get();
  console.log(`Total orders: ${snap.size}`);
  
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`Order ID: ${d.id}, Folio: ${data.folio}`);
    const invs = data.invoices || [];
    invs.forEach(inv => {
      console.log(`  - Inv ID: ${inv.id}, Folio: ${inv.folio}, CR: ${inv.collection?.contrareciboNumber}`);
    });
  });
}
check();
