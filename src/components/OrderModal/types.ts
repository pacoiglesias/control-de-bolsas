import type { Dispatch, SetStateAction } from 'react';
import type { PurchaseOrder, PurchaseOrderItem, Delivery, Invoice, FinancialConfig, OrderFinancials } from '../../lib/types';
import type { ParsedInvoiceData } from '../../lib/xmlParser';
import type { ParsedOC } from '../../lib/ocParser';
import { getOrderSummary } from '../../lib/finance';

export type OrderSummary = ReturnType<typeof getOrderSummary>;

export interface OrderModalFormState {
  folio: string;
  client: string;
  clientEmail: string;
  department: string;
  provider: string;
  oc: string;
  totalKilograms: string;
  estimatedDeliveryDate: any; // Timestamp | null
  deliveries: Delivery[];
  invoices: Invoice[];
  items: PurchaseOrderItem[];
  customCostPrice: string;
  customSellPrice: string;
  customCommissionRate: string;
  isClosedShort: boolean;
}

export type TabName = 'resumen' | 'productos' | 'andres' | 'entregas' | 'facturas';

export interface ComputedInvoice {
  inv: Invoice;
  fin: OrderFinancials;
  d: number | null;
  isLate: boolean;
}

export interface OrderModalContextType {
  // Estado principal
  form: OrderModalFormState;
  setForm: Dispatch<SetStateAction<OrderModalFormState>>;
  set: <K extends keyof OrderModalFormState>(k: K, v: OrderModalFormState[K]) => void;
  
  // Configuraciones y Permisos
  readOnly: boolean;
  dynamicConfig: FinancialConfig;
  config: FinancialConfig;
  provName: string;
  
  // Datos Calculados
  liveSummary: OrderSummary;
  computedInvoices: ComputedInvoice[];
  order: PurchaseOrder;
  kilosNum: number;
  kilosEntregados: number;
  kilosPedidos: number;
  kilosFaltantes: number;
  kilosPendientesDeFacturar: number;
  deliveredByItem: Record<string, number>;
  fallbackSale: number;
  fallbackCost: number;
  fallbackComm: number;
  
  // Catálogos
  allOrders: PurchaseOrder[];
  knownClients: string[];
  knownProviders: string[];
  knownClientEmails: string[];
  
  // Navegación UI
  tab: TabName;
  setTab: (t: TabName) => void;
  focusInvoiceId: string | null;
  
  // Herramientas externas (Toast, etc)
  toast: (msg: string, tone?: import('../../context/ToastContext').Tone, action?: any) => void;
  
  // --- Handlers: IA y Texto ---
  processFacturaText: (text: string) => void;
  processPagoText: (text: string) => void;
  processParsedXml: (data: ParsedInvoiceData) => void;
  parseOCAndFill: (text: string) => void;
  applyParsedOC: (parsed: ParsedOC) => void;
  emailClient: () => void;
  
  // --- Handlers: Productos ---
  // (Delegados a useOrderProducts.ts)
  
  // --- Handlers: Entregas ---
  // (Delegados a useOrderDeliveries.ts)
  
  // --- Handlers: Facturas ---
  // (Delegados a useInvoiceActions.ts y InvoiceWidget.tsx)
  
  // --- Impresiones ---
  printRemision: () => void;
  printPreFactura: () => void;
  printConsolidatedPackage: () => void;
  
  // --- Acciones de Ciclo de Vida ---
  save: () => Promise<void>;
  remove: () => Promise<void>;
  restore: () => Promise<void>;
  clickEliminar: () => void;
  confirmandoEliminar: boolean;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  retryAI: () => Promise<void>;
}
