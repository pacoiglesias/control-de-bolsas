import { z } from "zod";

export const facturaSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
  orderFolio: z.string().min(1, "Folio de OC requerido"),
  subtotal: z.number().nonnegative(),
  iva: z.number().nonnegative(),
  total: z.number().positive("Total debe ser positivo"),
  totalKilos: z.number().positive("Kilos facturados deben ser positivos"),
  issuedDate: z.string(),
  dueDate: z.string().optional(),
  status: z.enum(["pending", "paid", "cancelled", "overdue"]).default("pending"),
});

export type FacturaInput = z.infer<typeof facturaSchema>;
