/**
 * functions/src/index.ts — Punto de entrada unificado del backend ERP.
 *
 * Este archivo es únicamente un barrel de re-exportaciones.
 * Toda la lógica de negocio vive en sus módulos correspondientes:
 *   - modules/compras/    → sanitizePurchaseOrder, processPurchaseOrder
 *   - modules/cobranza/   → checkOverdueInvoices
 *   - modules/sistema/    → scheduledMidnightBackup, updateCajaChicaBalance
 *   - modules/facturacion/
 *   - modules/maquila/
 *   - handlers/           → funciones HTTP/callable heredadas
 *   - ai/                 → parseDocumentData (Gemini)
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

initializeApp();
setGlobalOptions({ region: "us-east1", maxInstances: 10 });

// ── Módulos de negocio ───────────────────────────────────────────────────────
export { checkOverdueInvoices } from "./modules/cobranza/handlers";
export { sanitizePurchaseOrder, processPurchaseOrder } from "./modules/compras/handlers";
export { scheduledMidnightBackup, updateCajaChicaBalance } from "./modules/sistema/handlers";
export { syncDashboardStats, recalcDashboardStats } from "./stats";

// ── Handlers HTTP / Callable (legado) ───────────────────────────────────────
export { parseDocumentData } from "./ai/extractor";
export {
  getActiveMaquilaOrders,
  registrarEntregaMaquila,
  importarEntregaMaquilaPendiente,
} from "./handlers/maquilaPortal";
export { enviarRecordatoriosVencimiento } from "./handlers/notifications";
export { parseUploadedPDF, reprocessOrder } from "./handlers/uploadProcessing";

// ── Namespaces de módulo (para uso desde cliente Firebase Admin) ─────────────
export * as ComprasModule from "./modules/compras";
export * as FacturacionModule from "./modules/facturacion";
export * as MaquilaModule from "./modules/maquila";
export * as CobranzaModule from "./modules/cobranza";
export * as SistemaModule from "./modules/sistema";

// ── Middleware y utilidades exportables ──────────────────────────────────────
export * from "./middleware/errorHandler";
export * from "./middleware/validation";
export * from "./utils/logging";
