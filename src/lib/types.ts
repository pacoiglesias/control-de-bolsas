import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pedido' | 'facturado' | 'pending' | 'paid' | 'overdue' | 'manual_review';

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

export interface Delivery {
  id: string;
  date: Timestamp | null;
  kilos: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  folio?: string;
  kilos: number;
  financials?: OrderFinancials;
  creditCycle: CreditCycle;
  collection?: CollectionInfo;
}

export interface PurchaseOrder {
  id: string;
  fileName?: string;
  client?: string;
  department?: string;
  provider?: string;
  totalKilograms?: number;
  estimatedDeliveryDate?: Timestamp | null;
  
  // Legacy fields (will be migrated to invoices[0])
  folio?: string;
  financials?: OrderFinancials;
  creditCycle?: CreditCycle; // Made optional for legacy, but actually we use it for overall status if needed, though we can derive it. Wait, let's keep it to store overall state if we want, or remove it. Let's keep it optional.
  collection?: CollectionInfo;

  deliveries?: Delivery[];
  invoices?: Invoice[];

  processedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  aiError?: string;
}

export interface Expense {
  id: string;
  date: Timestamp | null;
  concept: string;
  amount: number;
  type: 'ingreso' | 'egreso';
  notes?: string;
  createdAt: Timestamp | null;
}

export type PurchaseStatus = 'pedido' | 'parcial' | 'entregado';

export interface Purchase {
  id: string;
  date: Timestamp | null;
  provider: string;
  expectedKilos: number;
  receivedKilos: number;
  pricePerKg: number;
  totalAmount: number;
  paidAmount: number;
  status: PurchaseStatus;
  notes?: string;
  createdAt: Timestamp | null;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pedido: 'Pedido',
  facturado: 'Facturado',
  pending: 'Con Contrarecibo',
  paid: 'Cobrada',
  overdue: 'Vencida',
  manual_review: 'Revisión manual',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pedido: 'b-info',
  facturado: 'b-warn',
  pending: 'b-info',
  paid: 'b-ok',
  overdue: 'b-bad',
  manual_review: 'b-warn',
};
