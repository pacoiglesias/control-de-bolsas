import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { facturaSchema, type FacturaInput } from "./validators";

export function validateInvoiceData(rawInvoice: unknown): FacturaInput {
  loggerPro.info("Validando factura CFDI...", { rawInvoice });
  const validated = validateSchema(facturaSchema, rawInvoice);
  loggerPro.info(`Factura ${validated.invoiceNumber} validada exitosamente.`);
  return validated;
}
