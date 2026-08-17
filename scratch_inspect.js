const admin = require('firebase-admin');
const path = require('path');

// Initialize admin with default application credentials or project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'control-de-bolsas-89c88'
  });
}

const db = admin.firestore();

async function inspectOrders() {
  const snap = await db.collection('purchaseOrders').get();
  console.log(`TOTAL DOCUMENTS IN purchaseOrders: ${snap.docs.length}`);
  
  snap.docs.forEach((doc, idx) => {
    const data = doc.data();
    console.log(`${idx + 1}. ID: ${doc.id} | Folio: ${data.folio} | OC: ${data.oc} | CR: ${data.collection?.contrareciboNumber} | isDeleted: ${data.isDeleted} | Invoices: ${(data.invoices || []).length}`);
  });
}

inspectOrders().catch(console.error);
