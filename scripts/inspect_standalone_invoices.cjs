const admin = require('../functions/node_modules/firebase-admin');

async function inspect() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();

  const invSnapshot = await db.collection('invoices').get();
  console.log(`Standalone invoices collection has ${invSnapshot.size} documents.`);
  invSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- Invoice doc: ${doc.id} | folio: ${data.folio} | kilos: ${data.kilos} | CR: ${data.collection?.contrareciboNumber || data.contrarecibo || ''}`);
  });
}

inspect().catch(console.error);
