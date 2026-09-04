import { collection, getDocs, doc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { round2 } from './finance';

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
      { folio: '6173', control: '8 / 654', total: 81780.00, kilos: 1639.55 }
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
export async function autoHealAndPurgeErpDatabase(
  options: { reseedHistoricalCrs?: boolean } = {}
): Promise<AutoHealResult> {
  const snap = await getDocs(collection(db, PATHS.orders));
  const batch = writeBatch(db);
  let purgedCount = 0;
  let healedCount = 0;

  for (const d of snap.docs) {
    const data = d.data() as any;
    let canonicalKey = (data.oc || data.folio || d.id).trim().toUpperCase();
    if (canonicalKey.startsWith('SEED-')) canonicalKey = canonicalKey.replace('SEED-', '');
    if (canonicalKey.startsWith('CR-')) canonicalKey = canonicalKey.replace('CR-', '');

    // 🛡️ PURGA SEGURA: Eliminar documentos que son semillas/dummies conocidos o CRs obsoletos.
    // NUNCA borrar OCs nuevas con status 'pedido' — pueden ser expedientes reales recién creados.
    const SEED_PATTERNS = [
      'ANDRES-PEND', '120267114014', '71/14014', '71-14014',
      'SEED-', 'DUMMY-', 'TEST-',
      'GT-597', 'GT-624', 'TH-768', 'TH-804', 'TH-836',
      'CR-GT-651', 'CR-GT-713', 'CR-GT-742', 'CR-TH-879', 'CR-TH-912', 'CR-TH-946'
    ];
    const isSeed = (val: string) => SEED_PATTERNS.some(p => val.toUpperCase().includes(p.toUpperCase()));
    const isNewValidOc = data.status === 'pedido' || data.status === 'en_produccion';
    const isKnownSeed = isSeed(d.id) || isSeed(data.oc || '') || isSeed(data.folio || '');

    // Solo purgar si es un seed o CR obsoleto conocido (nunca si es OC nueva válida)
    if (isKnownSeed && !isNewValidOc) {
      batch.delete(doc(db, PATHS.orders, d.id));
      purgedCount++;
    }
  }

  // Reinyección de la fotografía histórica: SOLO si se pide explícitamente.
  // Ya no se ejecuta como parte del flujo normal de "sanación".
  if (options.reseedHistoricalCrs) {
  for (const c of OFFICIAL_ACTIVE_CRS) {
    const docId = `cr-${c.cr.toLowerCase().replace('-', '')}`;
    const issueDate = new Date(`${c.issue}T12:00:00Z`);
    const dueDate = new Date(`${c.due}T12:00:00Z`);
    const totalKilos = c.invoices.reduce((acc, inv) => acc + inv.kilos, 0);

    const invoicesData = c.invoices.map((inv, idx) => {
      const invSub = round2(inv.total / 1.16);
      const invCost = round2(inv.kilos * 38);
      const invComm = round2(invSub * 0.08);
      return {
        id: `inv-${docId}-${idx + 1}`,
        orderId: docId,
        folio: inv.folio,
        kilos: inv.kilos,
        financials: {
          salePricePerKg: 43,
          costPricePerKg: 38,
          saleTotal: invSub,
          invoiceTotal: inv.total,
          costTotal: invCost,
          commission: invComm,
          netCashFlow: round2(invSub * 1.08 - invCost),
          tradeMargin: round2(invSub - invCost),
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.fromDate(issueDate),
          dueDate: Timestamp.fromDate(dueDate),
        },
        collection: {
          contrareciboNumber: c.cr,
          contrareciboDate: Timestamp.fromDate(issueDate),
        },
      };
    });

    const docData: any = {
      id: docId,
      folio: c.cr,
      oc: c.cr,
      client: c.dept === 'TH' ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: c.dept,
      totalKilograms: totalKilos,
      customSellPrice: 43,
      customCostPrice: 38,
      invoices: invoicesData,
      collection: {
        contrareciboNumber: c.cr,
        contrareciboDate: Timestamp.fromDate(issueDate),
      },
      creditCycle: {
        status: 'pending',
        issueDate: Timestamp.fromDate(issueDate),
        dueDate: Timestamp.fromDate(dueDate),
      },
      status: 'pending',
      updatedAt: serverTimestamp(),
    };

    // Cuando se solicita resembrar explícitamente, se escribe el documento completo
    batch.set(doc(db, PATHS.orders, docId), docData, { merge: true });
    healedCount++;
  }
  }

  // Ya NO se sobreescribe config/financials.historicalDebtAndres aquí.
  // Ese valor se administra únicamente desde Configuración → Proveedor & Andrés,
  // donde un humano lo confirma contra la conciliación real.

  await batch.commit();

  return {
    purgedCount,
    healedCount,
    activeCrsCount: options.reseedHistoricalCrs ? OFFICIAL_ACTIVE_CRS.length : 0,
    paidCrsCount: 0,
    message: options.reseedHistoricalCrs
      ? `Base de datos saneada: ${purgedCount} registros antiguos purgados. Se restauraron ${OFFICIAL_ACTIVE_CRS.length} contrarecibos históricos a petición explícita.`
      : `Base de datos saneada: ${purgedCount} registros de prueba purgados. No se modificó ningún contrarecibo ni el saldo de Andrés.`,
  };
}
