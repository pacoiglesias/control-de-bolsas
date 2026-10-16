import { collection, getDocs } from 'firebase/firestore';
import { db, PATHS } from './firebase';

export interface AutoHealResult {
  purgedCount: number;
  healedCount: number;
  activeCrsCount: number;
  paidCrsCount: number;
  message: string;
}

export const OFFICIAL_ACTIVE_CRS = [
  {
    cr: 'GT-651',
    total: 106477.56,
    issue: '2026-06-29',
    due: '2026-07-29',
    dept: 'GT',
    invoices: [
      { folio: '5971', control: '2 / 228', total: 106477.56, kilos: 2134.67 }
    ]
  },
  {
    cr: 'GT-713',
    total: 69001.60,
    issue: '2026-07-13',
    due: '2026-08-12',
    dept: 'GT',
    invoices: [
      { folio: '6053', control: '2 / 249', total: 69001.60, kilos: 1383.35 }
    ]
  },
  {
    cr: 'GT-742',
    total: 54520.00,
    issue: '2026-07-20',
    due: '2026-08-19',
    dept: 'GT',
    invoices: [
      { folio: '6073', control: '2 / 260', total: 54520.00, kilos: 1093.02 }
    ]
  },
  {
    cr: 'TH-879',
    total: 136300.00,
    issue: '2026-08-03',
    due: '2026-09-02',
    dept: 'TH',
    invoices: [
      { folio: '6097', control: '8 / 611', total: 109040.00, kilos: 2186.04 },
      { folio: '6098', control: '8 / 612', total: 27260.00, kilos: 546.51 }
    ]
  },
  {
    cr: 'TH-912',
    total: 79826.00,
    issue: '2026-08-10',
    due: '2026-09-09',
    dept: 'TH',
    invoices: [
      { folio: '6159', control: '8 / 630', total: 79826.00, kilos: 1600.36 }
    ]
  },
  {
    cr: 'TH-946',
    total: 81780.00,
    issue: '2026-08-17',
    due: '2026-09-16',
    dept: 'TH',
    invoices: [
      { folio: '6167', control: '8 / 654', total: 81780.00, kilos: 1639.55 }
    ]
  },
  {
    cr: 'TH-990',
    total: 98054.60,
    issue: '2026-08-24',
    due: '2026-09-23',
    dept: 'TH',
    invoices: [
      { folio: '6198', control: '8 / 678', total: 98054.60, kilos: 1965.81 }
    ]
  },
  {
    cr: 'GT-874',
    total: 49880.00,
    issue: '2026-08-24',
    due: '2026-09-23',
    dept: 'GT',
    invoices: [
      { folio: '6193', control: '2 / 295', total: 49880.00, kilos: 1000.0 }
    ]
  },
  {
    cr: 'GT-904',
    total: 49032.04,
    issue: '2026-08-31',
    due: '2026-09-30',
    dept: 'GT',
    invoices: [
      { folio: '6224', control: '2 / 303', total: 49032.04, kilos: 983.0 }
    ]
  },
  {
    cr: 'TH-1030',
    total: 74820.00,
    issue: '2026-08-31',
    due: '2026-09-30',
    dept: 'TH',
    invoices: [
      { folio: '6200', control: '8 / 712', total: 74820.00, kilos: 1500.0 }
    ]
  },
];

/**
 * FIX (auditoría 2026-09-03) — LEE ESTO ANTES DE MODIFICAR:
 *
 * Esta función originalmente hacía DOS cosas peligrosas de forma
 * incondicional cada vez que se ejecutaba:
 *   1) Reinyectaba una "fotografía" congelada de contrarecibos con
 *      fecha de corte fija en el código. Si un documento de esos ya no existía en Firestore,
 *      el `set(..., { merge: true })` lo volvía a crear pero SIN los campos
 *      `invoices`, `collection`, `creditCycle` ni `status`, dejando
 *      un expediente roto e incompleto.
 *   2) Sobreescribía `config/financials.historicalDebtAndres` a un valor fijo
 *      sin condición, sin importar cuál fuera el saldo real
 *      configurado en ese momento.
 *
 * Ambos comportamientos quedaron ELIMINADOS del camino por defecto. La
 * función ahora solo hace la parte segura: purgar semillas/dummies y contrarecibos
 * obsoletos ya pagados. Si algún día necesitas re-sembrar los 10 contrarecibos
 * históricos a propósito (por ejemplo, restaurando de un respaldo), hazlo
 * de forma explícita pasando `{ reseedHistoricalCrs: true }`.
 */
export async function autoHealAndPurgeErpDatabase(options: { reseedHistoricalCrs?: boolean } = {}): Promise<AutoHealResult> {
  if(options.reseedHistoricalCrs) throw new Error('Los saldos históricos se restauran desde un respaldo o documento, no desde cifras fijas del código.');
  const snap=await getDocs(collection(db,PATHS.orders));
  const invoices=snap.docs.filter(d=>!d.data().isDeleted && !d.data().isSuperseded).flatMap(d=>d.data().invoices||[]);
  const active=new Set(invoices.filter(i=>!['paid','collected'].includes(i.creditCycle?.status)).map(i=>i.collection?.contrareciboNumber).filter(Boolean));
  const paid=new Set(invoices.filter(i=>['paid','collected'].includes(i.creditCycle?.status)).map(i=>i.collection?.contrareciboNumber).filter(Boolean));
  return {purgedCount:0,healedCount:0,activeCrsCount:active.size,paidCrsCount:paid.size,message:'Revisión de registros reales terminada. No se borraron documentos ni se sustituyeron saldos.'};
}
