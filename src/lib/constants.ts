/**
 * =========================================================================
 * Control Bolsas ERP — Constantes Canónicas de Negocio (Single Source of Truth)
 * =========================================================================
 *
 * REGLA: Todo valor canónico de negocio (CRs, OCs, clientes, departamentos)
 * se define AQUÍ y se importa donde se necesite. Prohibido duplicar.
 */

// ---------------------------------------------------------------------------
// Cartera Oficial Activa — 10 Contrarecibos Vigentes del Portal Providencia
// ---------------------------------------------------------------------------

/** Folios de contrarecibo activos por cobrar (Únicamente los 4 vigentes reportados). */
export const OFFICIAL_VALID_CRS = [
  'GT-1106',
  'TH-1271',
  'GT-1074',
  'TH-1237',
] as const;

export type OfficialCR = (typeof OFFICIAL_VALID_CRS)[number];

/** Contrarecibos Oficiales Ya Pagados y Validados por Providencia */
export const OFFICIAL_PAID_CRS_LIST = [
  'GT-1047',
  'TH-1195',
  'GT-1020',
  'TH-1158',
  'GT-993',
  'GT-962',
  'TH-1103',
  'GT-929',
  'TH-1068',
  'GT-904',
  'TH-1030',
  'GT-874',
  'TH-990',
  'TH-946',
  'TH-912',
  'TH-879',
  'TH-836',
  'GT-742',
  'TH-804',
  'GT-713',
  'TH-768',
  'TH-739',
  'GT-651',
  'TH-713',
] as const;

/** Saldo oficial actual en efectivo en caja al día de hoy */
export const SALDO_CAJA_ACTUAL = 451848.56;

// ---------------------------------------------------------------------------
// Órdenes de Compra Maestras y Oficiales de Providencia
// ---------------------------------------------------------------------------

// ─── 2 OCs ACTIVAS OFICIALES (27/Oct/2026) ───────────────────────────────────
export const OC_TH_ACTIVE = '120267114400';   // ✅ ACTIVA · Textil Hogar — Nava (No. Ord. 71/14400 · 9,500 kg · $418,000 · $44/kg)
export const OC_GT_ACTIVE = '12026439834';    // ✅ ACTIVA · Grupo Textil — Evelia / P4 (No. Ord. 43/9834 · 1,300 kg · $55,900 · $43/kg)
// ─── OCs CERRADAS / HISTÓRICAS ──────────────────────────────────────────────
export const OC_GT_9806 = '12026439806';      // ✅ CERRADA · Grupo Textil — Evelia / P4 (No. Ord. 43/9806 · 2,500 kg)
export const OC_GT_9807 = '12026439807';      // ✅ CERRADA · Grupo Textil — Evelia / P4 (No. Ord. 43/9807 · 3,000 kg)
export const OC_TH_14302 = '120267114302';    // ✅ CERRADA · Textil Hogar — Nava (No. Ord. 71/14302 · 8,000 kg · F-6392 amparada)
export const OC_GT_9784 = '12026439784';      // ✅ CERRADA · Grupo Textil — Evelia / P4 (No. Ord. 43/9784 · 5,100 kg)
export const OC_TH_NAVA = '120267114114';     // ✅ HISTÓRICA · Textil Hogar — Nava / Torre Lamuño
export const OC_GT_EVELIA = '12026439713';    // ✅ HISTÓRICA · Grupo Textil — Evelia / P4
export const OC_GT_NEW = '12026439753';       // ✅ CERRADA · Grupo Textil — P4-ALM (No. Ord. 43/9753 · 4,500 kg)

export const MASTER_OCS = [
  OC_TH_ACTIVE,
  OC_GT_ACTIVE,
  OC_GT_9806,
  OC_GT_9807,
  OC_TH_14302,
  OC_GT_9784,
  OC_TH_NAVA,
  OC_GT_EVELIA,
  OC_GT_NEW,
] as const;

/** Detecta si un string corresponde a la OC de TH (Nava) */
export function isOcTH(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (
    clean.includes('14400') ||
    clean.includes('120267114400') ||
    clean.includes('14302') ||
    clean.includes('120267114302') ||
    clean.includes('14114') ||
    clean.includes('120267114114') ||
    clean.includes('12026114099') ||
    clean.includes('114099')
  );
}

/** Detecta si un string corresponde a una OC oficial de GT (Evelia) */
export function isOcGT(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (
    clean.includes('9834') || clean.includes('12026439834') ||
    clean.includes('9807') || clean.includes('12026439807') ||
    clean.includes('9806') || clean.includes('12026439806') ||
    clean.includes('9784') || clean.includes('12026439784') ||
    clean.includes('9753') || clean.includes('12026439753') ||
    clean.includes('9713') || clean.includes('12026439713')
  );
}

// ---------------------------------------------------------------------------
// Clientes Canónicos
// ---------------------------------------------------------------------------

export const CLIENT_TH = 'TEXTIL HOGAR (TH - NAVA)';
export const CLIENT_GT = 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)';

// ---------------------------------------------------------------------------
// Departamentos Canónicos
// ---------------------------------------------------------------------------

export const DEPT_TH = 'TH';
export const DEPT_GT = 'GT';
export const DEPT_TH_ALMACEN = 'TH-ALMACEN-1';
export const DEPT_GT_ALMACEN = 'P4-ALM';

// ---------------------------------------------------------------------------
// Padrón Oficial de Cartera Activa Vigente ($359,111.06 MXN)
// 4 Contrarecibos Vigentes del Portal Providencia
// ---------------------------------------------------------------------------

export const CARTERA_OFICIAL = [
  { cr: 'GT-1106', monto:  85544.20, factura: '6380', dept: DEPT_GT, issueDate: '2026-10-19', dueDate: '2026-11-18' },
  { cr: 'TH-1271', monto:  98986.86, factura: '6381', dept: DEPT_TH, issueDate: '2026-10-19', dueDate: '2026-11-18' },
  { cr: 'GT-1074', monto:  99760.00, factura: '6372', dept: DEPT_GT, issueDate: '2026-10-12', dueDate: '2026-11-11' },
  { cr: 'TH-1237', monto:  74820.00, factura: '6373', dept: DEPT_TH, issueDate: '2026-10-12', dueDate: '2026-11-11' },
] as const;

export const TOTAL_CARTERA_OFICIAL = 359111.06;

// ---------------------------------------------------------------------------
// Vencidos Oficiales Providencia (Referencia de Auditoría $49,880.00 MXN · GT-874)
// ---------------------------------------------------------------------------
export const TOTAL_VENCIDOS_OFICIAL = 49880.00;
export const CR_VENCIDO_OFICIAL = 'GT-874';

// ---------------------------------------------------------------------------
// Facturas en Revisión / Pendientes de Asignación de CR ($174,580.00 MXN)
// ---------------------------------------------------------------------------
export const FACTURAS_EN_REVISION_OFICIAL = [
  {
    folio: '6363',
    uuid: 'B9B267E1-6363-47C0-89AA-74820TH14302',
    oc: '120267114302',
    folioOc: '71/14302',
    client: CLIENT_TH,
    department: DEPT_TH,
    kilos: 1500.00,
    subtotal: 64500.00,
    iva: 10320.00,
    total: 74820.00,
    dateStr: '2026-10-06',
  },
  {
    folio: '6367',
    uuid: 'E7B349A2-6367-4DF8-B821-49880GT9784',
    oc: '12026439784',
    folioOc: '43/9784',
    client: CLIENT_GT,
    department: DEPT_GT,
    kilos: 1000.00,
    subtotal: 43000.00,
    iva: 6880.00,
    total: 49880.00,
    dateStr: '2026-10-07',
  },
  {
    folio: '6368',
    uuid: 'C87994D1-096C-4581-9F31-5079148AE13C',
    oc: '12026439784',
    folioOc: '43/9784',
    client: CLIENT_GT,
    department: DEPT_GT,
    kilos: 1000.00,
    subtotal: 43000.00,
    iva: 6880.00,
    total: 49880.00,
    dateStr: '2026-10-07',
  },
] as const;

export const TOTAL_FACTURAS_REVISION_OFICIAL = 174580.00;
export const TOTAL_KILOS_REVISION_OFICIAL = 3500.00;

// ─── Remisión 114400 — OC 120267114400 (TH · Nava) ───────────────────────────
// Firmada por Ahmed Flores Grande · 27/Oct/2026 · 6,805.76 kg @ $44.00/kg
// Estado: ENTREGADA FÍSICAMENTE — PENDIENTE DE TIMBRAR (invoiced: false)
export const REMISION_TH_114400_FOLIO = '114400';
export const REMISION_TH_114400_DATE  = '2026-10-27';
export const REMISION_TH_114400_KG    = 6805.76;
export const REMISION_TH_114400_PRICE = 44.00;
export const REMISION_TH_114400_SUBTOTAL  = 299453.44; // 6805.76 × $44.00
export const REMISION_TH_114400_TOTAL_IVA = 347365.99; // × 1.16
export const REMISION_TH_114400_SIGNER    = 'Ahmed Flores Grande';

/** Kilos físicamente entregados en planta que aún no tienen CFDI timbrado.
 *  Fuente: Remisión 114400 (OC 71/14400 · TH Nava) — 27/Oct/2026. */
export const PENDIENTE_POR_FACTURAR_OFICIAL = 6805.76;

/** OC 71/14400: 9,500 kg pedidos. F-6438 ya facturada (1,325 kg) + Rem-114400
 *  (6,805.76 kg pendiente) = 8,130.76 kg entregados total. Faltan 1,369.24 kg. */
export const OC_TH_14400_KG_PEDIDOS     = 9500.00;
export const OC_TH_14400_KG_ENTREGADOS  = 8130.76;  // F-6438(1325) + Rem-114400(6805.76)
export const OC_TH_14400_KG_FACTURADOS  = 1325.00;  // Solo F-6438
export const OC_TH_14400_KG_FALTANTES   = 1369.24;  // 9500 - 8130.76
export const OC_TH_14400_KG_PATIO       = 6805.76;  // Rem-114400 sin timbrar

export const DEUDA_TOTAL_PROVIDENCIA_OFICIAL = 1070983.46; // $896,403.46 cartera + $174,580.00 en revisión


// ---------------------------------------------------------------------------
// Padrón Oficial de Cartera Ya Pagada ($1,032,087.04 MXN)
// ---------------------------------------------------------------------------

export const CARTERA_PAGADA_OFICIAL = [
  { no: 1,  cr: 'TH-912', monto:  79826.00, factura: '6159',      dept: DEPT_TH, issueDate: '2026-08-10', paidDate: '2026-09-09' },
  { no: 2,  cr: 'TH-879', monto: 136300.00, factura: '6097 6098', dept: DEPT_TH, issueDate: '2026-08-03', paidDate: '2026-09-02' },
  { no: 3,  cr: 'TH-836', monto: 106720.17, factura: '',          dept: DEPT_TH, issueDate: '2026-07-27', paidDate: '2026-08-26' },
  { no: 4,  cr: 'GT-742', monto:  54520.00, factura: '6073',      dept: DEPT_GT, issueDate: '2026-07-20', paidDate: '2026-08-19' },
  { no: 5,  cr: 'TH-804', monto: 136300.00, factura: '',          dept: DEPT_TH, issueDate: '2026-07-20', paidDate: '2026-08-19' },
  { no: 6,  cr: 'GT-713', monto:  69001.60, factura: '6053',      dept: DEPT_GT, issueDate: '2026-07-13', paidDate: '2026-08-12' },
  { no: 7,  cr: 'TH-768', monto: 125254.25, factura: '',          dept: DEPT_TH, issueDate: '2026-07-13', paidDate: '2026-08-12' },
  { no: 8,  cr: 'TH-739', monto: 109040.00, factura: '',          dept: DEPT_TH, issueDate: '2026-07-06', paidDate: '2026-08-05' },
  { no: 9,  cr: 'GT-651', monto: 106477.56, factura: '5971',      dept: DEPT_GT, issueDate: '2026-06-29', paidDate: '2026-07-29' },
  { no: 10, cr: 'TH-713', monto: 108647.46, factura: '',          dept: DEPT_TH, issueDate: '2026-06-29', paidDate: '2026-07-29' },
] as const;

export const TOTAL_CARTERA_PAGADA = 1032087.04;

// ---------------------------------------------------------------------------
// Parámetros Financieros por Defecto
// ---------------------------------------------------------------------------

export const PRECIO_COSTO_KG  = 38;   // Costo de compra a Andrés (MXN/kg)
export const PRECIO_VENTA_KG  = 43;   // Precio de venta a Providencia (MXN/kg)
export const IVA_RATE          = 0.16; // 16%
export const COMISION_CONTADOR = 0.08; // 8% sobre subtotal
export const MARGEN_LIBRE_KG   = 8.44; // Margen libre en caja (MXN/kg)

// ---------------------------------------------------------------------------
// IDs de Documentos Dummy/Seed que deben ignorarse (anti-corrupción)
// ---------------------------------------------------------------------------

export const SEED_BLACKLIST = [
  'ANDRES-PEND',
  '120267114014',
  '71/14014',
  '71-14014',
  '14014',
  'GT-597',
  'GT-624',
] as const;

/** Verifica si un ID/folio pertenece a la lista negra de seeds */
export function isSeedDocument(id: string): boolean {
  const upper = id.toUpperCase();
  return SEED_BLACKLIST.some(seed => upper.includes(seed));
}
