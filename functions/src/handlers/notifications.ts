import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp, getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { COL_ORDERS } from "./shared";

/**
 * NUEVO (roadmap #3 de docs/MEJORAS_FUTURAS.txt, "Automatización de
 * Cobranza"): el usuario pidió avanzar el canal de email (SendGrid) --
 * WhatsApp/Twilio queda para cuando decida activarlo, con el mismo patrón.
 *
 * Requiere que el usuario cree su propia cuenta de SendGrid (verifique un
 * remitente) y configure estos 2 secretos -- este archivo NO funciona por
 * sí solo sin ellos, y a propósito falla de forma silenciosa/informativa
 * (no rompe el deploy ni las demás Cloud Functions) si todavía no están
 * configurados:
 *
 *   firebase functions:secrets:set SENDGRID_API_KEY
 *   firebase functions:secrets:set SENDGRID_FROM_EMAIL
 *
 * `SENDGRID_FROM_EMAIL` debe ser un remitente verificado en SendGrid (single
 * sender o dominio autenticado) -- SendGrid rechaza el envío si no lo es.
 */
export const sendgridApiKey = defineSecret("SENDGRID_API_KEY");
export const sendgridFromEmail = defineSecret("SENDGRID_FROM_EMAIL");

interface RecordatorioPendiente {
  ref: FirebaseFirestore.DocumentReference;
  orderId: string;
  folio: string;
  clientEmail: string;
  dueDate: Timestamp;
  milestone: "antes" | "hoy";
  yaEnviados: string[];
  esRoot: boolean;
  invoiceIndex: number;
}

function construirCorreo(folio: string, dueDateStr: string, milestone: "antes" | "hoy") {
  const asunto = milestone === "hoy"
    ? `Factura ${folio} vence hoy`
    : `Recordatorio: factura ${folio} vence mañana`;
  const cuerpo = milestone === "hoy"
    ? `La factura con folio ${folio} vence hoy (${dueDateStr}). Te agradecemos programar el pago en la fecha acordada.`
    : `Este es un recordatorio de que la factura con folio ${folio} vence mañana (${dueDateStr}).`;
  return { asunto, cuerpo };
}

/**
 * Envía el recordatorio "vence mañana"/"vence hoy" a Providencia por email,
 * 1 día antes del vencimiento y el día del vencimiento -- mismo criterio de
 * negocio que ya usa `checkOverdueInvoices` para decidir qué SÍ cuenta como
 * vencido: una factura sin contrarecibo no tiene un plazo de crédito real
 * corriendo todavía (el plazo arranca cuando Providencia emite el CR), así
 * que tampoco tiene sentido recordarle un vencimiento que aún no empezó.
 *
 * A propósito NO reemplaza el registro en `system_logs` que ya deja
 * `checkOverdueInvoices` -- ese sigue siendo la fuente de verdad visible en
 * /logs incluso si el email falla o SendGrid no está configurado todavía.
 */
export const enviarRecordatoriosVencimiento = onSchedule(
  { schedule: "every day 08:00", timeZone: "America/Mexico_City", secrets: [sendgridApiKey, sendgridFromEmail] },
  async () => {
    const apiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    if (!apiKey || !fromEmail) {
      logger.info(
        "enviarRecordatoriosVencimiento: SENDGRID_API_KEY/SENDGRID_FROM_EMAIL todavía no están " +
        "configurados -- no se envía ningún correo. Configúralos con " +
        "`firebase functions:secrets:set` cuando tengas tu cuenta de SendGrid lista.",
      );
      return;
    }
    sgMail.setApiKey(apiKey);

    const db = getFirestore();
    const ahora = Timestamp.now();
    const unDiaMs = 24 * 60 * 60 * 1000;

    const snapshot = await db.collection(COL_ORDERS)
      .where("invoiceStatuses", "array-contains", "pending")
      .get();

    if (snapshot.empty) {
      logger.info("enviarRecordatoriosVencimiento: no hay facturas pendientes que revisar.");
      return;
    }

    const milestoneDe = (dueDate: Timestamp): "antes" | "hoy" | null => {
      const diffDias = Math.floor((dueDate.toMillis() - ahora.toMillis()) / unDiaMs);
      if (diffDias === 1) return "antes";
      if (diffDias === 0) return "hoy";
      return null;
    };

    const pendientes: RecordatorioPendiente[] = [];

    snapshot.docs.forEach((d: QueryDocumentSnapshot) => {
      const data = d.data();
      const clientEmail = String(data.clientEmail || "").trim();
      const folioOrden = data.folio || d.id;
      const crDelExpediente = !!data.collection?.contrareciboNumber;

      // a) Modelo legacy: el ciclo vive en la raíz del documento.
      const cc = data.creditCycle as { status?: string; dueDate?: Timestamp | null } | undefined;
      if (cc?.status === "pending" && cc.dueDate && crDelExpediente) {
        const milestone = milestoneDe(cc.dueDate);
        if (milestone && clientEmail) {
          const yaEnviados: string[] = Array.isArray(data.collection?.reminderMilestonesSent)
            ? data.collection.reminderMilestonesSent
            : [];
          if (!yaEnviados.includes(milestone)) {
            pendientes.push({
              ref: d.ref, orderId: d.id, folio: folioOrden, clientEmail,
              dueDate: cc.dueDate, milestone, yaEnviados, esRoot: true, invoiceIndex: -1,
            });
          }
        }
      }

      // b) Modelo nuevo: cada factura trae su propio ciclo.
      const invoices: Record<string, unknown>[] = Array.isArray(data.invoices) ? data.invoices : [];
      invoices.forEach((inv, idx) => {
        const invCc = inv.creditCycle as { status?: string; dueDate?: Timestamp | null } | undefined;
        const invCollection = inv.collection as { contrareciboNumber?: string; reminderMilestonesSent?: string[] } | undefined;
        const tieneCr = !!(invCollection?.contrareciboNumber || crDelExpediente);
        if (invCc?.status !== "pending" || !invCc.dueDate || !tieneCr) return;
        const milestone = milestoneDe(invCc.dueDate);
        if (!milestone || !clientEmail) return;
        const yaEnviados = Array.isArray(invCollection?.reminderMilestonesSent) ? invCollection!.reminderMilestonesSent! : [];
        if (yaEnviados.includes(milestone)) return;
        pendientes.push({
          ref: d.ref, orderId: d.id, folio: (inv.folio as string) || folioOrden, clientEmail,
          dueDate: invCc.dueDate, milestone, yaEnviados, esRoot: false, invoiceIndex: idx,
        });
      });
    });

    if (pendientes.length === 0) {
      logger.info("enviarRecordatoriosVencimiento: sin recordatorios por enviar hoy.");
      return;
    }

    const sinCorreo = snapshot.docs.filter((d) => !String(d.data().clientEmail || "").trim()).map((d) => d.data().folio || d.id);
    if (sinCorreo.length > 0) {
      logger.warn(`enviarRecordatoriosVencimiento: ${sinCorreo.length} expediente(s) sin clientEmail, no se les puede enviar recordatorio: ${sinCorreo.slice(0, 20).join(", ")}`);
    }

    const enviados: string[] = [];
    const fallidos: string[] = [];

    for (const p of pendientes) {
      const dueDateStr = p.dueDate.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      const { asunto, cuerpo } = construirCorreo(p.folio, dueDateStr, p.milestone);
      try {
        await sgMail.send({
          to: p.clientEmail,
          from: fromEmail,
          subject: asunto,
          text: cuerpo,
        });
        enviados.push(`${p.folio} (${p.milestone})`);

        // Marca el hito como enviado para que la corrida de mañana no lo
        // repita -- se escribe inmediatamente por registro (no en batch al
        // final) para que un fallo a medio proceso no pierda el progreso ya
        // hecho ni reenvíe lo que sí salió.
        if (p.esRoot) {
          await p.ref.update({
            "collection.reminderMilestonesSent": FieldValue.arrayUnion(p.milestone),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const snap = await p.ref.get();
          const invoices: Record<string, unknown>[] = Array.isArray(snap.data()?.invoices) ? snap.data()!.invoices : [];
          if (invoices[p.invoiceIndex]) {
            const inv = invoices[p.invoiceIndex];
            const invCollection = (inv.collection as Record<string, unknown>) || {};
            const yaEnviados: string[] = Array.isArray(invCollection.reminderMilestonesSent) ? invCollection.reminderMilestonesSent as string[] : [];
            invoices[p.invoiceIndex] = {
              ...inv,
              collection: { ...invCollection, reminderMilestonesSent: [...yaEnviados, p.milestone] },
            };
            await p.ref.update({ invoices, updatedAt: FieldValue.serverTimestamp() });
          }
        }
      } catch (err) {
        fallidos.push(`${p.folio} (${p.milestone})`);
        logger.error(`enviarRecordatoriosVencimiento: fallo al enviar a ${p.orderId}/${p.folio}`, err);
      }
    }

    await db.collection("system_logs").add({
      user: "sistema (enviarRecordatoriosVencimiento)",
      action: "Recordatorios de Vencimiento Enviados (automático)",
      details: { enviados: enviados.length, fallidos: fallidos.length, folios: enviados.slice(0, 50), folioFallidos: fallidos.slice(0, 50), sinCorreo: sinCorreo.slice(0, 50) },
      timestamp: FieldValue.serverTimestamp(),
    });
    logger.info(`enviarRecordatoriosVencimiento: ${enviados.length} enviados, ${fallidos.length} fallidos.`);
  },
);
