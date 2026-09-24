// Constantes y estilos compartidos entre MaquiladorPortal.tsx y
// MaquiladorPortalPinScreen.tsx. Extraidos de MaquiladorPortal.tsx (que
// llegaba a 1796 lineas) para que la pantalla de PIN pudiera separarse a su
// propio archivo sin duplicar estas definiciones.

/* ─── Estilos Glassmorphism Premium ────────────────────────────────────────── */
export const glass = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

export const kpiCard = (accent: string, bg = 'rgba(255, 255, 255, 0.05)') => ({
  ...glass,
  background: bg,
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  borderLeft: `4px solid ${accent}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
});

export const STORAGE_PIN_KEY = 'maquila_saved_pin_v2';
export const STORAGE_DELIVERIES_KEY = 'maquila_recent_deliveries_v2';
export const STORAGE_OFFLINE_QUEUE_KEY = 'maquila_offline_queue_v2';

/* ─── Tipos del dominio Maquila ─────────────────────────────────────────────── */

/** Orden de maquila activa devuelta por la Cloud Function getActiveMaquilaOrders */
export interface ActiveMaquilaOrder {
  id: string;
  folio: string;
  productDescription: string;
  department?: string;
  pendingKilos: number;
  totalKilos: number;
  deliveredKilos?: number;
  notes?: string;
  status?: string;
}

/** Entrega local guardada en localStorage / historial */
export interface MaquilaDelivery {
  date: string;
  orderId: string;
  folio?: string;
  productDescription?: string;
  kilos: number;
  status: 'approved' | 'pending_approval' | 'pending_offline';
  docType?: 'remision' | 'factura';
  docFolio?: string | null;
  notes?: string | null;
}

/** Aviso de ultima entrega para mostrar el banner post-registro */
export interface LastDeliveredNotice {
  kilos: number;
  folio?: string;
  product?: string;
  notes?: string | null;
}

/** Entrada del libro mayor (ledger) del estado de cuenta */
export interface MaquilaLedgerEntry {
  concept: string;
  cargo: number;
  abono: number;
  saldo: number;
  fecha?: string;
}

/** Estado de cuenta completo devuelto por la Cloud Function (action: ledger) */
export interface MaquilaStatement {
  saldoProveedor: number;
  totalEntregado?: number;
  totalPagado?: number;
  ledger?: MaquilaLedgerEntry[];
  [key: string]: unknown;
}
