import { z } from "zod";

export const orderItemSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional(),
  description: z.string().min(1, "Descripción requerida"),
  quantity: z.number().positive("La cantidad en kilos debe ser positiva"),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  unit: z.string().default("Kilos"),
});

export const compraSchema = z.object({
  id: z.string().optional(),
  folio: z.string().min(1, "Folio de OC requerido"),
  client: z.string().default("GRUPO TEXTIL PROVIDENCIA"),
  plant: z.string().default("TH-ALMACEN-1"),
  totalKilos: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  items: z.array(orderItemSchema).min(1, "Al menos una partida requerida"),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CompraInput = z.infer<typeof compraSchema>;
