const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({
  projectId: 'control-de-bolsas-89c88'
});
const db = getFirestore();

async function run() {
  const snap = await db.collection('expenses').get();
  snap.docs.forEach(d => {
    const e = d.data();
    console.log(`ID: ${d.id}, Concept: "${e.concept}", isDeleted: ${e.isDeleted}, provider: ${e.provider}, amount: ${e.amount}, type: ${e.type}`);
  });
}

run();
