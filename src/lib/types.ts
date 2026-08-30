import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pedido' | 'facturado' | 'pending' | 'in_review' | 'paid' | 'collected' | 'overdue' | 'manual_review';

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
  
  /** Identidad Corporativa */
  companyName?: string;
  companyLogoUrl?: string;
}

export const DEFAULT_CONFIG: FinancialConfig = {
  /** Subtotal por kilo, SIN IVA. Con el 16% da el total que aparece en los
   *  contrarecibos y facturas: 43 × 1.16 = 49.88. No poner 49.88 aquí, o el
   *  sistema le sumaría el IVA otra vez.
   *  ACTUALIZADO 2026-08-10 (Iteracion 98): el precio real bajó de 47 a 43
   *  (verificado contra la hoja de control del usuario, "COSTO VENTA A
   *  PROVIDENCIA = 43 mas IVA", y confirmado directamente por el usuario:
   *  "el precio antes era 47 ahora ya es de 43"). Este valor es solo el
   *  RESPALDO para expedientes que no traigan su propio precio capturado --
   *  los que ya tienen un precio propio en financials.salePricePerKg no
   *  cambian con este ajuste. */
  salePricePerKg: 43,
  costPricePerKg: 38,
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
  historicalDebtAndres: 13411.84,
  // Tomados de los CFDIs oficiales del negocio (CFDI 4.0); editables en Configuración.
  satClaveProdServ: '24141500',
  satClaveUnidad: 'KGM',
  satMetodoPago: 'PPD',
  satFormaPago: '99',
  companyName: 'Elemental Denim Bolsas',
  companyLogoUrl: '',
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

export type ContrareciboPortalStatus = 'generado' | 'en_proceso_pago' | 'pagado' | 'sin_numero';

/** Datos de cobranza. El backend no los escribe: los captura el administrador
 *  desde la interfaz conforme avanza el ciclo de cobro. */
export interface CollectionInfo {
  contrareciboNumber?: string;
  contrareciboDate?: Timestamp | null;
  contrareciboPortalStatus?: ContrareciboPortalStatus;
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
  
  /** Indica si la comisión de contabilidad (el 8%) ya fue liquidada/reconciliada. */
  accountantLiquidated?: boolean;
  accountantLiquidatedAt?: Timestamp | null;
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
  docType?: 'remision' | 'factura';
  docFolio?: string;
  driver?: string;
  packagesCount?: number;
  photoUrl?: string;
}

export interface Invoice {
  id: string;
  orderId: string; // Relación con el expediente padre
  client?: string; // Copia para mostrar en el tablero sin buscar el expediente
  uuid?: string;
  folio?: string;
  oc?: string;
  kilos: number;
  financials?: OrderFinancials;
  creditCycle: CreditCycle;
  collection?: CollectionInfo;
  items?: PurchaseOrderItem[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
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

export const CANONICAL_TH_ITEMS: PurchaseOrderItem[] = [
  { id: 'it-th-1', code: 'egbo000107-sc', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-th-2', code: 'enbo000167-bl', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-th-3', code: 'egbo000103-sc', description: 'BULTO 80 X 20 +20 X 160 *250', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-th-4', code: 'enbo000006-sc', description: 'BOLSA POLIETILENO 77 CM X 55 CM _Sin Color', quantity: 2000, unitPrice: 43.0, amount: 86000, unit: 'Kilos' },
  { id: 'it-th-5', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-th-6', code: 'enbo000044-sc', description: 'BOLSA POLIETILENO 30 X 40 CM', quantity: 500, unitPrice: 43.0, amount: 21500, unit: 'Kilos' },
];

export const CANONICAL_GT_ITEMS: PurchaseOrderItem[] = [
  { id: 'it-gt-1', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-gt-2', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
  { id: 'it-gt-3', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 700, unitPrice: 43.0, amount: 30100, unit: 'Kilos' },
  { id: 'it-gt-4', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'Kilos' },
];

export function getEffectiveOrderItems(order?: PurchaseOrder | null): PurchaseOrderItem[] {
  if (!order) return [];
  if (order.items && order.items.length > 0) return order.items;
  
  const text = `${order.department || ''} ${order.client || ''} ${order.oc || ''} ${order.folio || ''}`.toUpperCase();
  if (text.includes('TH') || text.includes('TEXTIL HOGAR') || text.includes('NAVA') || text.includes('LAMU') || text.includes('14114')) {
    return CANONICAL_TH_ITEMS;
  }
  if (text.includes('GT') || text.includes('GRUPO TEXTIL') || text.includes('EVELIA') || text.includes('P4') || text.includes('439713')) {
    return CANONICAL_GT_ITEMS;
  }
  return [];
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
  /**
   * Sigue siendo la fuente de verdad real y funcional. Se intento migrar
   * las facturas a su propia coleccion (ver context/InvoicesContext.tsx),
   * pero ese intento se revirtio: el nombre de la coleccion nunca
   * coincidio con lo que la escribia (invoices vs invoicesV2), dejando
   * a toda la app sin ver ninguna factura de ningun expediente. No
   * marcar esto como deprecado hasta que la migracion este completa Y
   * verificada con datos reales -- ver PLAN_DE_MEJORA_TOTAL.md, seccion 3.
   */
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
  isClosedShort?: boolean;
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
  /**
   * Marca explícita para pagos a Andrés. Evita depender de normalización de
   * texto libre en `provider` (frágil a typos: "Andrés", "andres garcia",
   * "Andres Lopez" todos quedan fuera del cómputo si no cuadran exacto).
   * Backward compatible: el código existente con normalizarTexto() sigue
   * funcionando mientras se migra gradualmente a este campo.
   */
  isAndresPayment?: boolean;
  /** Categoría para separar OPEX de pagos a proveedor en el P&L */
  category?: 'proveedor' | 'opex' | 'nomina' | 'servicios' | 'otro';
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
  pending: 'Por Cobrar',
  in_review: '🔵 En Revisión (Esperando CR)',
  paid: '🟡 Con el Contador',
  collected: '✅ Recibida',
  overdue: '🔴 Vencida',
  manual_review: 'Revisión Manual',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pedido: 'b-info',
  facturado: 'b-warn',
  pending: 'b-info',
  in_review: 'b-info',
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
  lastOrderDate?: Timestamp | null;
  createdAt?: Timestamp | null;
}

export interface AndresRequirement {
  orderId: string;
  folio: string;
  client: string;
  kilos: number;
  costPricePerKg: number;
  costTotal: number;
  salePricePerKg: number;
  saleTotal: number;
  invoiceTotal: number;
  commissionEst: number;
  netProfitEst: number;
  profitPerKg: number;
  items: PurchaseOrderItem[];
  whatsappMessage: string;
}

export interface NextActionInfo {
  key: 'pedir_andres' | 'esperar_entrega' | 'facturar_entrega' | 'pedir_contrarecibo' | 'avisar_contador' | 'recibir_caja' | 'completada';
  title: string;
  description: string;
  actionLabel?: string;
  badgeTone: 'info' | 'warn' | 'bad' | 'ok';
  targetTab?: 'resumen' | 'andres' | 'entregas' | 'facturas' | 'costos';
  whatsappType?: 'andres' | 'providencia' | 'contador';
  whatsappText?: string;
}

