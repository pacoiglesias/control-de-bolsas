const admin = require('../functions/node_modules/firebase-admin');

async function find6271and6167() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();

  const snapshot = await db.collection('purchaseOrders').get();
  console.log(`Checking ${snapshot.size} orders...`);

  snapshot.forEach(doc => {
    const str = JSON.stringify(doc.data());
    if (str.includes('6271')) {
      console.log(`FOUND 6271 in order ${doc.id}! Data summary:`, {
        id: doc.id,
        oc: doc.data().oc || doc.data().folio,
        isDeleted: doc.data().isDeleted,
        invoices: doc.data().invoices?.map(i => i.folio)
      });
    }
    if (str.includes('6167')) {
      console.log(`FOUND 6167 in order ${doc.id}! Data summary:`, {
        id: doc.id,
        oc: doc.data().oc || doc.data().folio,
        isDeleted: doc.data().isDeleted,
        invoices: doc.data().invoices?.map(i => i.folio)
      });
    }
  });
}

find6271and6167().catch(console.error);
