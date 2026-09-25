const admin = require('../functions/node_modules/firebase-admin');

async function inspect() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'control-de-bolsas-89c88' });
  }
  const db = admin.firestore();

  const snapshot = await db.collection('purchaseOrders').get();
  console.log(`Loaded ${snapshot.size} orders from Firestore.\n`);

  const foliosToCheck = ['6200', '6266', '6271', '6307', '6302', '6275', '6276', '6284', '6285', '6224', '6193', '6198', '6167'];
  
  const foundMap = {};

  snapshot.forEach(doc => {
    const o = doc.data();
    (o.invoices || []).forEach(inv => {
      const f = (inv.folio || '').toString();
      const cr = inv.collection?.contrareciboNumber || inv.contrarecibo || o.collection?.contrareciboNumber || '';
      foundMap[f] = {
        orderId: doc.id,
        orderOc: o.oc || o.folio,
        invoiceId: inv.id,
        cr: cr,
        kilos: inv.kilos,
        total: inv.financials?.invoiceTotal,
        status: inv.creditCycle?.status
      };
    });
  });

  console.log('Result for target invoices:');
  foliosToCheck.forEach(f => {
    if (foundMap[f]) {
      console.log(`Factura #${f} -> In OC: ${foundMap[f].orderOc} (Doc: ${foundMap[f].orderId}) | CR: "${foundMap[f].cr}" | Status: ${foundMap[f].status}`);
    } else {
      console.log(`Factura #${f} -> NOT FOUND in any order!`);
    }
  });
}

inspect().catch(console.error);
