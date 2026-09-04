import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { entregaMaquilaSchema, type EntregaMaquilaInput } from "./validators";

// ────────────────────────────────────────────────────────────────────────────
// validateEntregaMaquila — helper de validación pura (sin efecto secundario).
// ────────────────────────────────────────────────────────────────────────────
export function validateEntregaMaquila(rawDelivery: unknown): EntregaMaquilaInput {
  loggerPro.info("Validando entrega física de maquila...", { rawDelivery });
  const validated = validateSchema(entregaMaquilaSchema, rawDelivery);
  loggerPro.info(
    `Entrega de ${validated.kilos} kg para ${validated.orderFolio} validada con éxito.`,
  );
  return validated;
}

// ────────────────────────────────────────────────────────────────────────────
// Re-exportaciones del handler legacy (bridge pattern).
//
// Los handlers completos del Portal Maquilador (PIN, listar órdenes, registrar
// entrega, importar entrega retroactiva) residen en handlers/maquilaPortal.ts
// hasta que se complete su migración. Se re-exportan aquí para que el módulo
// sea la única puerta de entrada desde index.ts.
//
// ⚠️ NO renombrar las funciones exportadas — Firebase las identifica por su
//    nombre en el despliegue; cambiarlos crea funciones duplicadas y deja
//    huérfanas las actuales.
// ────────────────────────────────────────────────────────────────────────────
export {
  getActiveMaquilaOrders,
  registrarEntregaMaquila,
  importarEntregaMaquilaPendiente,
} from "../../handlers/maquilaPortal";
