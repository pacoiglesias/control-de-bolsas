const admin = require('../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
}
const db = admin.firestore();

async function patchBillingPolicy() {
  console.log('Parcheando invoiceBillingPolicy en OCs 9806 y 9807...');

  const targets = [
    { id: 'oc-12026439806', folio: '43/9806' },
    { id: 'oc-12026439807', folio: '43/9807' },
  ];

  for (const { id, folio } of targets) {
    const ref = db.collection('purchaseOrders').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error('ERROR: Documento ' + id + ' no existe en Firestore');
      continue;
    }
    const data = snap.data();
    if (data.invoiceBillingPolicy === 'truncate_half_kilo_each_line') {
      console.log('OK: OC ' + folio + ' (' + id + ') ya tiene invoiceBillingPolicy correcto -- sin cambios');
      continue;
    }
    await ref.update({
      invoiceBillingPolicy: 'truncate_half_kilo_each_line',
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log('PATCH: OC ' + folio + ' (' + id + ') invoiceBillingPolicy = truncate_half_kilo_each_line aplicado');
  }

  console.log('\nVerificacion final:');
  for (const { id, folio } of targets) {
    const snap = await db.collection('purchaseOrders').doc(id).get();
    const d = snap.data();
    console.log('  ' + folio + ': invoiceBillingPolicy = ' + d.invoiceBillingPolicy);
  }

  console.log('\nPatch completado. Process exit.');
  process.exit(0);
}

patchBillingPolicy().catch(console.error);
