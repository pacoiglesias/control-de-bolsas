import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { contrareciboSchema, type ContrareciboInput } from "./validators";

export function validateContrarecibo(rawCr: unknown): ContrareciboInput {
  loggerPro.info("Validando contrarecibo de cobro...", { rawCr });
  const validated = validateSchema(contrareciboSchema, rawCr);
  loggerPro.info(`Contrarecibo ${validated.crNumber} (${validated.department}) validado exitosamente.`);
  return validated;
}
