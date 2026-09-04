import * as admin from 'firebase-admin';

// Initialize admin SDK using default credentials or GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CARTERA_OFICIAL = [
  { cr: 'GT-651', monto: 106477.56, factura: 'F-5971', dept: 'GT' },
  { cr: 'GT-713', monto:  69001.60, factura: 'F-6053', dept: 'GT' },
  { cr: 'GT-742', monto:  54520.00, factura: 'F-6073', dept: 'GT' },
  { cr: 'TH-879', monto: 136300.00, factura: 'F-6097/F-6098', dept: 'TH' },
  { cr: 'TH-912', monto:  79826.00, factura: 'F-6159', dept: 'TH' },
  { cr: 'TH-946', monto:  81780.00, factura: 'F-6173', dept: 'TH' },
  { cr: 'TH-990', monto:  98054.60, factura: 'F-6198', dept: 'TH' },
  { cr: 'GT-874', monto:  49880.00, factura: 'F-6193', dept: 'GT' },
  { cr: 'GT-904', monto:  49032.04, factura: 'F-6224', dept: 'GT' },
  { cr: 'TH-1030', monto: 74820.00, factura: 'F-6200', dept: 'TH' },
];

async function run() {
  try {
    const docRef = db.collection('config').doc('carteraOficial');
    await docRef.set({
      crs: CARTERA_OFICIAL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Cartera oficial migrada a Firestore con éxito!');
  } catch (error) {
    console.error('❌ Error migrando cartera:', error);
  }
}

run();
