import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pending' | 'paid' | 'overdue' | 'manual_review';

export interface FinancialConfig {
  salePricePerKg: number;
  costPricePerKg: number;
  commissionRate: number;
  creditDays: number;
  /** IVA de la factura al cliente. El cliente paga el total con IVA. */
  ivaRate: number;
  /** Sobre qué importe cobra su comisión contabilidad. */
  commissionBase: 'subtotal' | 'total';
}

export const DEFAULT_CONFIG: FinancialConfig = {
  salePricePerKg: 47,
  costPricePerKg: 42,
  commissionRate: 0.069,
  creditDays: 30,
  ivaRate: 0.16,
  commissionBase: 'subtotal',
};

export interface OrderFinancials {
  salePricePerKg: number;
  costPricePerKg: number;
  commissionRate?: number;
  saleTotal?: number;
  /** Lo que realmente le cobras al cliente: subtotal + IVA. */
  invoiceTotal?: number;
  costTotal?: number;
  commission?: number;
  netCashFlow: number;
}

export interface CreditCycle {
  issueDate?: Timestamp | null;
  dueDate?: Timestamp | null;
  status: OrderStatus;
}

/** Datos de cobranza. El backend no los escribe: los captura el administrador
 *  desde la interfaz conforme avanza el ciclo de cobro. */
export interface CollectionInfo {
  contrareciboNumber?: string;
  contrareciboDate?: Timestamp | null;
  paidAmount?: number;
  paidAt?: Timestamp | null;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  fileName?: string;
  folio?: string;
  client?: string;
  totalKilograms?: number;
  financials?: OrderFinancials;
  creditCycle: CreditCycle;
  collection?: CollectionInfo;
  processedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  aiError?: string;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Por cobrar',
  paid: 'Cobrada',
  overdue: 'Vencida',
  manual_review: 'Revisión manual',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'b-info',
  paid: 'b-ok',
  overdue: 'b-bad',
  manual_review: 'b-warn',
};
