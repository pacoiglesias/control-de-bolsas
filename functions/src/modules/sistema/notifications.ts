import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getOrdersWithDeadline } from "../compras/handlers";

/**
 * Cloud Function programada cada 6 horas (0 * / 6 * * *)
 * Alerta sobre órdenes de compra y facturas próximas a vencer o vencidas.
 */
export const checkDeadlines = onSchedule(
  {
    schedule: "0 */6 * * *",
    timeZone: "America/Mexico_City",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const now = new Date();
    logger.info("Iniciando revisión proactiva de vencimientos (checkDeadlines)...");
    const orders = await getOrdersWithDeadline(now);
    let sentCount = 0;

    for (const order of orders) {
      const remainingText =
        order.daysRemaining <= 0
          ? "está vencida"
          : order.daysRemaining === 1
          ? "vence mañana"
          : `vence en ${order.daysRemaining} días`;

      const message = `OC ${order.folio} ${remainingText}`;
      await sendNotification(order.userId, message, order.id);
      sentCount++;
    }

    logger.info(`checkDeadlines completado: ${sentCount} alertas emitidas.`);
  }
);

export async function sendNotification(
  userId: string,
  message: string,
  orderId?: string
) {
  const db = getFirestore();

  // Evitar notificaciones duplicadas idénticas activas
  const recentSnap = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .where("message", "==", message)
    .where("read", "==", false)
    .limit(1)
    .get();

  if (!recentSnap.empty) {
    return;
  }

  await db.collection("notifications").add({
    userId,
    message,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
    type: "deadline",
    orderId: orderId || null,
  });
}
