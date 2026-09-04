import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { entregaMaquilaSchema, type EntregaMaquilaInput } from "./validators";

export function validateEntregaMaquila(rawDelivery: unknown): EntregaMaquilaInput {
  loggerPro.info("Validando entrega física de maquila...", { rawDelivery });
  const validated = validateSchema(entregaMaquilaSchema, rawDelivery);
  loggerPro.info(`Entrega de ${validated.kilos} kg para ${validated.orderFolio} validada con éxito.`);
  return validated;
}
