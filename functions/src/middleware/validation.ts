import { z } from "zod";
import { ValidationError } from "./errorHandler";

export function validateSchema<Output, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = unknown>(
  schema: z.ZodType<Output, Def, Input>,
  data: unknown,
): Output {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new ValidationError(`Error de validación: ${errorMsg}`);
  }
  return result.data;
}
