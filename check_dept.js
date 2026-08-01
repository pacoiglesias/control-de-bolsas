import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

// Leemos el firebase config original 
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

async function check() {
  console.log("Fetching orders...");
  const snap = await getDocs(collection(db, "purchaseOrders"));
  const depts = new Map();
  snap.forEach(d => {
    const data = d.data();
    const dept = data.department;
    if(dept) {
        depts.set(dept, (depts.get(dept) || 0) + 1);
    } else {
        depts.set('NULL/UNDEFINED', (depts.get('NULL/UNDEFINED') || 0) + 1);
    }
  });
  console.log("Departments found:");
  depts.forEach((count, dept) => {
    console.log(`- ${dept}: ${count} orders`);
  });
  
  process.exit(0);
}
check();
