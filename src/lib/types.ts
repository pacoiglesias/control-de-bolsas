import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pedido' | 'facturado' | 'pending' | 'paid' | 'collected' | 'overdue' | 'manual_review';

export interface FinancialConfig {
  salePricePerKg: number;
  costPricePerKg: number;
  commissionRate: number;
  creditDays: number;
  /** IVA de la factura al cliente. El cliente paga el total con IVA. */
  ivaRate: number;
  /** Sobre qué importe cobra su comisión contabilidad. */
  commissionBase: 'subtotal' | 'total';
  /** Deuda histórica que nosotros tenemos con Andrés (en negativo si es pasivo nuestro) */
  historicalDebtAndres?: number;
  weightTolerancePercentage?: number;
  /** Clave de producto/servicio del SAT (catálogo c_ClaveProdServ). */
  satClaveProdServ?: string;
  /** Clave de unidad de medida del SAT (catálogo c_ClaveUnidad). */
  satClaveUnidad?: string;
  /** Método de pago SAT: PUE (una exhibición) o PPD (parcialidades/diferido). */
  satMetodoPago?: string;
  /** Forma de pago SAT (catálogo c_FormaPago). "99" = Por definir. */
  satFormaPago?: string;
}

export const DEFAULT_CONFIG: FinancialConfig = {
  /** Subtotal por kilo, SIN IVA. Con el 16% da los 54.52 que aparecen en los
   *  contrarecibos y facturas: 47 × 1.16 = 54.52. No poner 54.52 aquí, o el
   *  sistema le sumaría el IVA otra vez. */
  salePricePerKg: 47,
  costPricePerKg: 42,
  /** Honorario del contador por la gestión de cobro: 8% del SUBTOTAL. */
  commissionRate: 0.08,
  creditDays: 30,
  ivaRate: 0.16,
  /**
   * 8% sobre el SUBTOTAL (sin IVA). Verificado contra tres cobros reales; el
   * de 153,381.00 cuadra al centavo:
   *   subtotal 132,225.00 x 0.08 = 10,578.00  ← honorario exacto
   *   subtotal 132,225.00 x 1.08 = 142,803.00 ← depósito exacto
   * Regla practica: lo que te depositan = subtotal x 1.08.
   * No es un descuento del cliente (TH/GT paga la factura completa): es el
   * honorario que cobra el contador por gestionar la cobranza.
   */
  commissionBase: 'subtotal',
  historicalDebtAndres: -123175.56,
  // Tomados de una OC real del negocio; editables en Configuracion.
  satClaveProdServ: '24141500',
  satClaveUnidad: 'KGM',
  satMetodoPago: 'PPF',
  satFormaPago: '99',
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
  /** Margen bruto de la operacion: venta sin IVA menos costo. Lo calcula
   *  computeFinancials() en finance.core.ts y lo leen tanto el resumen del
   *  frontend como la agregacion de stats.ts, pero faltaba declararlo aqui. */
  tradeMargin?: number;
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
  collectedAt?: Timestamp | null;  // Cuando el contador entregó el efectivo
  /**
   * Referencia de la transferencia con la que el contador te entrega el
   * efectivo (ej. "TR_3583"). Es un identificador DISTINTO del contrarecibo
   * (ej. "GT-570"): sin este campo no había dónde anotarla, y sin ella no se
   * puede conciliar el depósito contra el estado de cuenta bancario.
   */
  transferRef?: string;
  sapDocument?: string;
  paymentDocument?: string;
  notes?: string;
  complementStatus?: 'pending' | 'issued' | 'na';
}

export interface Delivery {
  id: string;
  date: Timestamp | null;
  /**
   * TOTAL de esta entrega (suma de `items`, cuando existe). Se conserva por
   * compatibilidad con expedientes viejos migrados como "entrega historica
   * unica" (ver migrarEntregasLegacy en OrderModal.tsx) y como respaldo si
   * `items` viniera vacio.
   */
  kilos: number;
  /**
   * Qué se entregó en ESTE evento, renglón por renglón. Sin esto, "cuánto se
   * ha entregado" era un solo número acumulado sin saber ni la fecha ni qué
   * llegó cada vez — dos entregas de la misma OC eran indistinguibles.
   */
  items?: { itemId: string; quantity: number }[];
  /**
   * Si esta entrega YA generó una factura. Es lo que impide facturar la
   * misma entrega dos veces: una entrega con `invoiced: true` no vuelve a
   * mostrar el botón de facturar. La proteccion es estructural, no depende
   * de que nadie se acuerde de no volver a apretar el boton.
   */
  invoiced?: boolean;
  /** A qué factura quedó ligada, una vez facturada. */
  invoiceId?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  uuid?: string;
  folio?: string;
  oc?: string;
  kilos: number;
  financials?: OrderFinancials;
  creditCycle: CreditCycle;
  collection?: CollectionInfo;
}

export interface PurchaseOrderItem {
  id: string;
  code?: string;
  quantity: number;
  deliveredQuantity?: number;
  unit: string;
  description: string;
  unitPrice: number;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  fileName?: string;
  fileHash?: string;
  client?: string;
  /** Correo del cliente, opcional. Sin esto, "Notificar al cliente" no tenia
   *  ningun destinatario que precargar (ver Ciclo 29 en AUDIT_NOTEBOOK.md). */
  clientEmail?: string;
  department?: string;
  provider?: string;
  oc?: string;
  totalKilograms?: number;
  estimatedDeliveryDate?: Timestamp | null;
  
  // Legacy fields (will be migrated to invoices[0])
  folio?: string;
  financials?: OrderFinancials;
  creditCycle?: CreditCycle; // Made optional for legacy, but actually we use it for overall status if needed, though we can derive it. Wait, let's keep it to store overall state if we want, or remove it. Let's keep it optional.
  collection?: CollectionInfo;

  deliveries?: Delivery[];
  invoices?: Invoice[];
  /**
   * Copia desnormalizada de los estatus de `invoices[]`, en el mismo orden.
   *
   * Firestore no sabe consultar dentro de objetos de un arreglo, asi que este
   * campo plano es lo que sostiene TODAS las consultas del sistema: el
   * `array-contains-any` del Dashboard y de Cobranza, y el barrido nocturno
   * `checkOverdueInvoices`. Un expediente sin este campo existe en la base
   * pero es invisible para esas pantallas.
   *
   * Escribirlo siempre a traves de `camposInvoices()` en lib/invoiceOps.ts,
   * que garantiza que viaje junto con `invoices` y `updatedAt`.
   */
  invoiceStatuses?: string[];
  items?: PurchaseOrderItem[];
  
  customCostPrice?: number;
  customSellPrice?: number;
  customCommissionRate?: number;

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
  provider?: string;
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
  items?: PurchaseOrderItem[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pedido: 'Pedido',
  facturado: 'Facturado',
  pending: 'Por cobrar',
  paid: '🟡 Con el contador',
  collected: '✅ Recibida',
  overdue: 'Vencida',
  manual_review: 'Revisión manual',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pedido: 'b-info',
  facturado: 'b-warn',
  pending: 'b-info',
  paid: 'b-warn',
  collected: 'b-ok',
  overdue: 'b-bad',
  manual_review: 'b-warn',
};

export interface Product {
  id: string;
  code?: string;
  description: string;
  unit: string;
  defaultPrice: number;
  lastOrderDate?: any;
  createdAt?: any;
}
