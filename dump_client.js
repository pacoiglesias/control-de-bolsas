import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "control-de-bolsas-89c88",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching purchases...");
  const snap = await getDocs(collection(db, "purchases"));
  snap.docs.forEach(d => {
    const data = d.data();
    console.log("Purchase:", d.id, data);
    if (data.totalAmount === 145000 && data.receivedKilos === 2964.16) {
        console.log("Found the buggy purchase! Let's fix it.");
        const correctAmount = 2964.16 * 42; // 124494.72
        // await updateDoc(doc(db, "purchases", d.id), { totalAmount: correctAmount, pricePerKg: 42 });
    }
  });
}
run().catch(console.error);
