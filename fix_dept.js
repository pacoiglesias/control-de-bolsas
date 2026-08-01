import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";

const env = fs.readFileSync('.env', 'utf-8');
const firebaseConfig = {
  apiKey: env.match(/VITE_FIREBASE_API_KEY=(.*)/)[1],
  authDomain: env.match(/VITE_FIREBASE_AUTH_DOMAIN=(.*)/)[1],
  projectId: env.match(/VITE_FIREBASE_PROJECT_ID=(.*)/)[1],
  storageBucket: env.match(/VITE_FIREBASE_STORAGE_BUCKET=(.*)/)[1],
  messagingSenderId: env.match(/VITE_FIREBASE_MESSAGING_SENDER_ID=(.*)/)[1],
  appId: env.match(/VITE_FIREBASE_APP_ID=(.*)/)[1]
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fixing departments...");
  const snap = await getDocs(collection(db, "purchaseOrders"));
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    let dept = data.department;
    let needsUpdate = false;
    
    if (!dept) {
       const folio = (data.folio || "").toUpperCase();
       if (folio.includes("TH")) {
         dept = "TH";
         needsUpdate = true;
       } else if (folio.includes("GT")) {
         dept = "GT";
         needsUpdate = true;
       }
       
       if (needsUpdate) {
         console.log(`Updating order ${d.id} with department: ${dept}`);
         await updateDoc(doc(db, "purchaseOrders", d.id), { department: dept });
         updated++;
       }
    }
  }
  console.log(`Fixed ${updated} orders.`);
  process.exit(0);
}
run();
