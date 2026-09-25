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

/** Folios de contrarecibo activos por cobrar. */
export const OFFICIAL_VALID_CRS = [
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
] as const;

export type OfficialCR = (typeof OFFICIAL_VALID_CRS)[number];

/** Contrarecibos Oficiales Ya Pagados y Validados por Providencia ($1,032,087.04 MXN) */
export const OFFICIAL_PAID_CRS_LIST = [
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
export const SALDO_CAJA_ACTUAL = 844526.90;

// ---------------------------------------------------------------------------
// Órdenes de Compra Maestras y Oficiales de Providencia
// ---------------------------------------------------------------------------

export const OC_TH_NAVA = '120267114114';    // Textil Hogar — Nava / Torre Lamuño (Histórica)
export const OC_GT_EVELIA = '12026439713';   // Grupo Textil — Evelia / P4 (Histórica)
export const OC_GT_NEW = '12026439753';      // Grupo Textil — P4-ALM (No. Ord. 43/9753 · 4,500 kg)
export const OC_TH_ACTIVE = '120267114302';   // Textil Hogar — Nava / Torre Lamuño (No. Ord. 71/14302 · 8,000 kg) - ACTIVA
export const OC_GT_ACTIVE = '12026439784';   // Grupo Textil — Evelia / P4 (No. Ord. 43/9784 · 5,100 kg) - ACTIVA

export const MASTER_OCS = [OC_TH_ACTIVE, OC_GT_ACTIVE, OC_TH_NAVA, OC_GT_EVELIA, OC_GT_NEW] as const;

/** Detecta si un string corresponde a la OC de TH (Nava) */
export function isOcTH(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.includes('14302') || clean.includes('120267114302') || clean.includes('14114') || clean.includes('120267114114');
}

/** Detecta si un string corresponde a una OC oficial de GT (Evelia) */
export function isOcGT(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (
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
// Padrón Oficial de Cartera Activa Vigente ($805,190.14 MXN)
// ---------------------------------------------------------------------------

export const CARTERA_OFICIAL = [
  { cr: 'GT-993',  monto: 110434.32, factura: '6284 6285',  dept: DEPT_GT, issueDate: '2026-09-21', dueDate: '2026-10-21' },
  { cr: 'GT-962',  monto: 110783.48, factura: '6275 6276',  dept: DEPT_GT, issueDate: '2026-09-14', dueDate: '2026-10-14' },
  { cr: 'TH-1103', monto:  74820.00, factura: '6271',       dept: DEPT_TH, issueDate: '2026-09-14', dueDate: '2026-10-14' },
  { cr: 'GT-929',  monto:  83499.12, factura: '6267 6268',  dept: DEPT_GT, issueDate: '2026-09-07', dueDate: '2026-10-07' },
  { cr: 'TH-1068', monto:  72086.58, factura: '6266',       dept: DEPT_TH, issueDate: '2026-09-07', dueDate: '2026-10-07' },
  { cr: 'GT-904',  monto:  49032.04, factura: '6224',       dept: DEPT_GT, issueDate: '2026-08-31', dueDate: '2026-09-30' },
  { cr: 'TH-1030', monto:  74820.00, factura: '6200',       dept: DEPT_TH, issueDate: '2026-08-31', dueDate: '2026-09-30' },
  { cr: 'GT-874',  monto:  49880.00, factura: '6193',       dept: DEPT_GT, issueDate: '2026-08-24', dueDate: '2026-09-23' },
  { cr: 'TH-990',  monto:  98054.60, factura: '6198',       dept: DEPT_TH, issueDate: '2026-08-24', dueDate: '2026-09-23' },
  { cr: 'TH-946',  monto:  81780.00, factura: '6167',       dept: DEPT_TH, issueDate: '2026-08-17', dueDate: '2026-09-16' },
] as const;

export const TOTAL_CARTERA_OFICIAL = 805190.14;

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
