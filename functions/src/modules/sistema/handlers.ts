import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ────────────────────────────────────────────────────────────────────────────
// scheduledMidnightBackup
// Corre todos los días a las 00:00 (America/Mexico_City).
// Respalda colecciones críticas en la colección 'snapshots'.
// ────────────────────────────────────────────────────────────────────────────
export const scheduledMidnightBackup = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/Mexico_City",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    logger.info("Iniciando Respaldo Automático de Medianoche...");

    const collectionsToBackup = ["purchaseOrders", "purchases", "expenses", "products", "config"];
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const colName of collectionsToBackup) {
      const snap = await db.collection(colName).get();
      backupData[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      totalDocs += snap.size;
    }

    const timestamp = Date.now();
    const snapId = `snap_auto_${timestamp}`;
    const payload = JSON.stringify(backupData);
    const pesoKB = Math.round(payload.length / 1024);

    await db.collection("snapshots").doc(snapId).set({
      id: snapId,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "sistema (Respaldo Automático Medianoche)",
      totalOrders: backupData["purchaseOrders"]?.length || 0,
      totalPurchases: backupData["purchases"]?.length || 0,
      totalExpenses: backupData["expenses"]?.length || 0,
      facturasCount: (backupData["purchaseOrders"] || []).reduce(
        (a: number, o: any) => a + (o.invoices?.length || 0),
        0,
      ),
      payloadKB: pesoKB,
      type: "auto_midnight",
    });

    await db
      .collection("snapshots")
      .doc(snapId)
      .collection("blob")
      .doc("data")
      .set({ payload });

    // Actualizar puntero latest
    await db.collection("snapshots").doc("latest").set(
      {
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "sistema (Respaldo Automático Medianoche)",
        totalOrders: backupData["purchaseOrders"]?.length || 0,
        lastSnapshotId: snapId,
        payloadKB: pesoKB,
      },
      { merge: true },
    );

    logger.info(
      `Respaldo automático de medianoche completado: ${snapId} (${totalDocs} documentos, ${pesoKB} KB).`,
    );
  },
);

// ────────────────────────────────────────────────────────────────────────────
// updateCajaChicaBalance
// Trigger que mantiene el saldo de Caja Chica al día ante cualquier escritura
// en la colección 'expenses'.
//
// FIX (auditoría v8.9.5): el saldo vive en system_settings_private/finanzas,
// no en system_settings/global, para que no sea legible sin sesión.
// ────────────────────────────────────────────────────────────────────────────
export const updateCajaChicaBalance = onDocumentWritten(
  { document: "expenses/{expenseId}" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before && !after) return;

    let amountBefore = 0;
    if (before) {
      amountBefore = before.type === "ingreso" ? (before.amount || 0) : -(before.amount || 0);
    }

    let amountAfter = 0;
    if (after) {
      amountAfter = after.type === "ingreso" ? (after.amount || 0) : -(after.amount || 0);
    }

    const delta = amountAfter - amountBefore;
    if (delta !== 0) {
      const ref = getFirestore().doc("system_settings_private/finanzas");
      await ref.set({ cajaChicaBalance: FieldValue.increment(delta) }, { merge: true });
      logger.info(`Caja Chica updated by ${delta}`);
    }
  },
);
