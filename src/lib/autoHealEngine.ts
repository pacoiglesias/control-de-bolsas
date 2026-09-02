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
];

/**
 * Motor Autónomo de Sanación, Purga y Calibración 100% Automática de la Base de Datos.
 */
export async function autoHealAndPurgeErpDatabase(): Promise<AutoHealResult> {
  const snap = await getDocs(collection(db, PATHS.orders));
  const batch = writeBatch(db);
  let purgedCount = 0;
  let healedCount = 0;

  const activeCrKeys = new Set(OFFICIAL_ACTIVE_CRS.map(x => x.cr));

  for (const d of snap.docs) {
    const data = d.data() as any;
    let canonicalKey = (data.oc || data.folio || d.id).trim().toUpperCase();
    if (canonicalKey.startsWith('SEED-')) canonicalKey = canonicalKey.replace('SEED-', '');
    if (canonicalKey.startsWith('CR-')) canonicalKey = canonicalKey.replace('CR-', '');

    const crNum = (data.collection?.contrareciboNumber || data.contrarecibo || '').trim().toUpperCase();

    const isMasterTh = canonicalKey === '120267114114' || canonicalKey.includes('14114');
    const isMasterGt = canonicalKey === '12026439713' || canonicalKey.includes('9713');
    const isActiveCr = Array.from(activeCrKeys).some(k => canonicalKey.includes(k) || crNum.includes(k));

    // Purgar todo lo que no sea una de las 8 CRs activas o una de las 2 OCs maestras
    if (!isMasterTh && !isMasterGt && !isActiveCr) {
      batch.delete(doc(db, PATHS.orders, d.id));
      purgedCount++;
    }
  }

  // Inyectar los 8 Contrarecibos Vigentes Oficiales con sus partidas y facturas reales
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

    batch.set(doc(db, PATHS.orders, docId), docData, { merge: true });
    healedCount++;
  }

  // Calibrar Saldo Inicial de Andrés en Config ($103,411.84 a favor)
  batch.set(doc(db, PATHS.config, 'financials'), { historicalDebtAndres: 103411.84 }, { merge: true });

  await batch.commit();

  return {
    purgedCount,
    healedCount,
    activeCrsCount: OFFICIAL_ACTIVE_CRS.length,
    paidCrsCount: 0,
    message: `Base de datos saneada: ${purgedCount} registros antiguos purgados. Cartera activa establecida estrictamente en los 8 Contrarecibos Vigentes ($675,839.76).`,
  };
}
