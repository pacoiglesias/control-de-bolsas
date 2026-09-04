import { z } from "zod";

export const contrareciboSchema = z.object({
  id: z.string().optional(),
  crNumber: z.string().min(1, "Número de contrarecibo requerido"),
  department: z.enum(["TH", "GT", "GENERAL"]).default("TH"),
  monto: z.number().positive("Monto debe ser positivo"),
  invoices: z.array(z.string()).min(1, "Debe asociar al menos una factura"),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
  paymentDate: z.string().optional(),
});

export type ContrareciboInput = z.infer<typeof contrareciboSchema>;
