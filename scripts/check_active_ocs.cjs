const admin = require('../functions/node_modules/firebase-admin');

async function checkActiveOcs() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();

  const oc1 = await db.collection('purchaseOrders').doc('oc-120267114302').get();
  console.log('oc-120267114302 isDeleted:', oc1.data()?.isDeleted);

  const oc2 = await db.collection('purchaseOrders').doc('oc-12026439784').get();
  console.log('oc-12026439784 isDeleted:', oc2.data()?.isDeleted);
}

checkActiveOcs().catch(console.error);
