import { z } from "zod";

export const entregaMaquilaSchema = z.object({
  id: z.string().optional(),
  orderId: z.string().min(1, "ID de orden requerido"),
  orderFolio: z.string().min(1, "Folio de OC requerido"),
  kilos: z.number().positive("Los kilos entregados deben ser mayores a 0"),
  fecha: z.string().min(1, "Fecha de entrega requerida"),
  remision: z.string().optional(),
  notas: z.string().optional(),
  maquilador: z.string().default("Andrés"),
});

export type EntregaMaquilaInput = z.infer<typeof entregaMaquilaSchema>;
