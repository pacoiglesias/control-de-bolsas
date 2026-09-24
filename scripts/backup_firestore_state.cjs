const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

async function backup() {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  const db = admin.firestore();

  const collections = ['purchaseOrders', 'invoices', 'expenses', 'purchases', 'products', 'config'];
  const data = {
    timestamp: new Date().toISOString(),
    projectId: 'control-de-bolsas-89c88',
    collections: {},
  };

  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    data.collections[colName] = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`Colección ${colName}: ${snap.size} documentos respaldados.`);
  }

  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `firestore_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Respaldo completo guardado exitosamente en: ${filePath}`);
}

backup().catch(err => {
  console.error('Error en backup:', err);
  process.exit(1);
});
