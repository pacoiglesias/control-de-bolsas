const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Inicializa con las credenciales por defecto del entorno de gcloud/firebase
initializeApp({
  projectId: 'control-de-bolsas-89c88',
});

const db = getFirestore();

async function main() {
  const uid = 'goJCSjA3g5Vu3v3wRrZ3TkrWbmL2';
  const email = 'paco.iglesias@gmail.com';

  console.log(`Autorizando administrador en Firestore: admins/${uid} (${email})...`);

  await db.collection('admins').doc(uid).set({
    email: email,
    role: 'admin',
    createdAt: FieldValue.serverTimestamp(),
    authorizedBy: 'antigravity-cli'
  }, { merge: true });

  console.log(`¡Éxito! El documento admins/${uid} ha sido creado en Firestore.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al autorizar administrador:', err);
  process.exit(1);
});
