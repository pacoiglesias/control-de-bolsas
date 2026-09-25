const admin = require('../functions/node_modules/firebase-admin');

async function inspectCrTh946() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();

  const doc = await db.collection('purchaseOrders').doc('cr-th946').get();
  if (doc.exists) {
    console.log('cr-th946 data:', doc.data());
  } else {
    console.log('cr-th946 does not exist');
  }

  const allSnap = await db.collection('purchaseOrders').where('isDeleted', '==', true).get();
  console.log(`There are ${allSnap.size} deleted orders.`);
  allSnap.forEach(d => {
    console.log(`Deleted order ${d.id}: oc=${d.data().oc || d.data().folio}`);
  });
}

inspectCrTh946().catch(console.error);
