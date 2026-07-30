import { serverTimestamp } from 'firebase/firestore';
import type { Invoice } from './types';

/**
 * Los tres campos que SIEMPRE deben viajar juntos al escribir facturas.
 *
 * invoiceStatuses es el arreglo desnormalizado que sostiene la consulta del
 * barrido nocturno (checkOverdueInvoices). Vivía definida solo dentro de
 * Cobranza.tsx: las tres rutas de cobro la usaban, pero OrderModal.save
 * seguía calculando invoiceStatuses por su cuenta con un .map() suelto y sin
 * pasar por esta función — dos caminos para escribir lo mismo, con el mismo
 * riesgo de divergencia que ya tuvo la fórmula financiera antes de
 * consolidarse en finance.core.ts.
 */
export function camposInvoices(invoices: Invoice[]) {
  return {
    invoices,
    invoiceStatuses: invoices.map((i) => i.creditCycle?.status ?? 'pending'),
    updatedAt: serverTimestamp(),
  };
}

/** Aplica un cambio sobre UNA factura identificada por id, no por índice. */
export function aplicarPorId(
  invoices: Invoice[],
  invoiceId: string,
  cambio: (inv: Invoice) => Invoice,
): Invoice[] | null {
  const i = invoices.findIndex((x) => x.id === invoiceId);
  if (i < 0) return null;
  const copia = [...invoices];
  copia[i] = cambio(copia[i]);
  return copia;
}
