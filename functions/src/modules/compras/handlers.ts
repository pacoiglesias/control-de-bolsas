import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { compraSchema, type CompraInput } from "./validators";

export function processPurchaseOrder(rawOrder: unknown): CompraInput {
  loggerPro.info("Validando y procesando orden de compra...", { rawOrder });
  const validated = validateSchema(compraSchema, rawOrder);
  loggerPro.info(`Orden ${validated.folio} validada exitosamente. Total: $${validated.total}`);
  return validated;
}
