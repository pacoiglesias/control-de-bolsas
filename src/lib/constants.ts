/**
 * =========================================================================
 * Control Bolsas ERP — Constantes Canónicas de Negocio (Single Source of Truth)
 * =========================================================================
 *
 * REGLA: Todo valor canónico de negocio (CRs, OCs, clientes, departamentos)
 * se define AQUÍ y se importa donde se necesite. Prohibido duplicar.
 */

// ---------------------------------------------------------------------------
// Cartera Oficial Activa — 8 Contrarecibos Canónicos de Providencia
// ---------------------------------------------------------------------------

/** Folios de contrarecibo activos en cartera. Actualizar aquí y en ningún otro lugar. */
export const OFFICIAL_VALID_CRS = [
  'TH-1030',
  'GT-904',
  'GT-874',
  'TH-990',
  'TH-946',
  'TH-912',
  'TH-879',
  'GT-742',
  'GT-713',
  'GT-651',
] as const;

export type OfficialCR = (typeof OFFICIAL_VALID_CRS)[number];

// ---------------------------------------------------------------------------
// Órdenes de Compra Maestras de Providencia
// ---------------------------------------------------------------------------

export const OC_TH_NAVA = '120267114114';    // Textil Hogar — Nava / Torre Lamuño
export const OC_GT_EVELIA = '12026439713';   // Grupo Textil — Evelia / P4

export const MASTER_OCS = [OC_TH_NAVA, OC_GT_EVELIA] as const;

/** Detecta si un string corresponde a la OC maestra de TH */
export function isOcTH(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.includes('14114') || clean.includes('120267114114');
}

/** Detecta si un string corresponde a la OC maestra de GT */
export function isOcGT(s: string): boolean {
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.includes('9713') || clean.includes('12026439713');
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
// Padrón Oficial de Cartera Activa ($799,691.80 MXN)
// ---------------------------------------------------------------------------

export const CARTERA_OFICIAL = [
  { cr: 'GT-651', monto: 106477.56, factura: 'F-5971', dept: DEPT_GT },
  { cr: 'GT-713', monto:  69001.60, factura: 'F-6053', dept: DEPT_GT },
  { cr: 'GT-742', monto:  54520.00, factura: 'F-6073', dept: DEPT_GT },
  { cr: 'TH-879', monto: 136300.00, factura: 'F-6097/F-6098', dept: DEPT_TH },
  { cr: 'TH-912', monto:  79826.00, factura: 'F-6159', dept: DEPT_TH },
  { cr: 'TH-946', monto:  81780.00, factura: 'F-6173', dept: DEPT_TH },
  { cr: 'TH-990', monto:  98054.60, factura: 'F-6198', dept: DEPT_TH },
  { cr: 'GT-874', monto:  49880.00, factura: 'F-6193', dept: DEPT_GT },
  { cr: 'GT-904', monto:  49032.04, factura: 'F-6224', dept: DEPT_GT },
  { cr: 'TH-1030', monto: 74820.00, factura: 'F-6200', dept: DEPT_TH },
] as const;

export const TOTAL_CARTERA_OFICIAL = 799691.80;

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
] as const;

/** Verifica si un ID/folio pertenece a la lista negra de seeds */
export function isSeedDocument(id: string): boolean {
  const upper = id.toUpperCase();
  return SEED_BLACKLIST.some(seed => upper.includes(seed));
}
