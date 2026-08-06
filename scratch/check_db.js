import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  projectId: "control-de-bolsas-89c88",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Checking if Contrarecibo TH-875 exists...");
  const q = query(collection(db, "purchaseOrders"));
  const snap = await getDocs(q);
  let found = false;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.collection?.contrareciboNumber === "TH-875" || data.folio === "TH-875") {
        console.log("Found TH-875!", d.id, JSON.stringify(data));
        found = true;
    }
  });
  if (!found) console.log("TH-875 NOT FOUND in purchaseOrders.");
}
run().catch(console.error);
