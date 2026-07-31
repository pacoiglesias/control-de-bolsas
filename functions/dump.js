const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('purchases').get();
  console.log("PURCHASES:");
  snap.docs.forEach(d => console.log(d.id, d.data()));
  
  const expSnap = await db.collection('expenses').get();
  console.log("EXPENSES:");
  expSnap.docs.forEach(d => console.log(d.id, d.data()));
}
run();
