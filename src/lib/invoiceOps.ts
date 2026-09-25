import { serverTimestamp } from 'firebase/firestore';
import type { Invoice } from './types';

/**
 * Los tres campos que SIEMPRE deben viajar juntos al escribir facturas.
 *
 * invoiceStatuses es el arreglo desnormalizado que sostiene la consulta del
 * barrido nocturno y la del Dashboard. Vivía definida solo dentro de
 * Cobranza.tsx: sus rutas de cobro la usaban, pero OrderModal.save calculaba
 * invoiceStatuses por su cuenta con un .map() suelto — dos caminos para
 * escribir lo mismo, con el mismo riesgo de divergir que ya tuvo la fórmula
 * financiera antes de consolidarse en finance.core.ts.
 */
export function camposInvoices(invoices: Invoice[]) {
  let hasUndefined = false;
  for (const inv of invoices) {
    for (const val of Object.values(inv)) {
      if (val === undefined) {
        hasUndefined = true;
        break;
      }
    }
    if (hasUndefined) break;
  }

  const cleaned = hasUndefined
    ? invoices.map((inv) => {
        const copy: any = { ...inv };
        Object.keys(copy).forEach((k) => {
          if (copy[k] === undefined) copy[k] = null;
        });
        return copy;
      })
    : invoices;

  return {
    invoices: cleaned,
    invoiceStatuses: cleaned.map((i) => i.creditCycle?.status ?? 'pending'),
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
