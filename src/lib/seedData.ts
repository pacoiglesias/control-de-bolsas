import { doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { computeFinancials } from './finance';
import { DEFAULT_CONFIG, type OrderStatus } from './types';

export interface SeedItem {
  id: string;
  folio: string;
  client: string;
  total: number;
  issueDateStr: string;
  dueDateStr: string;
  status: OrderStatus;
  contrarecibo?: string;
  contrareciboDateStr?: string;
  notes?: string;
  origin: string;
}

export const INITIAL_SEED_DATA: SeedItem[] = [
  // 11 Contrarecibos
  {
    id: 'seed-GT-742',
    folio: 'GT-742',
    client: 'GT',
    total: 54520.00,
    issueDateStr: '2026-07-20',
    dueDateStr: '2026-08-19',
    status: 'pending',
    contrarecibo: 'GT-742',
    contrareciboDateStr: '2026-07-20',
    notes: 'Contrarecibo 1/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-TH-804',
    folio: 'TH-804',
    client: 'TH',
    total: 136300.00,
    issueDateStr: '2026-07-20',
    dueDateStr: '2026-08-19',
    status: 'pending',
    contrarecibo: 'TH-804',
    contrareciboDateStr: '2026-07-20',
    notes: 'Contrarecibo 2/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-GT-713',
    folio: 'GT-713',
    client: 'GT',
    total: 69001.60,
    issueDateStr: '2026-07-13',
    dueDateStr: '2026-08-12',
    status: 'pending',
    contrarecibo: 'GT-713',
    contrareciboDateStr: '2026-07-13',
    notes: 'Contrarecibo 3/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-TH-768',
    folio: 'TH-768',
    client: 'TH',
    total: 125254.25,
    issueDateStr: '2026-07-13',
    dueDateStr: '2026-08-12',
    status: 'pending',
    contrarecibo: 'TH-768',
    contrareciboDateStr: '2026-07-13',
    notes: 'Contrarecibo 4/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-TH-739',
    folio: 'TH-739',
    client: 'TH',
    total: 109040.00,
    issueDateStr: '2026-07-06',
    dueDateStr: '2026-08-05',
    status: 'pending',
    contrarecibo: 'TH-739',
    contrareciboDateStr: '2026-07-06',
    notes: 'Contrarecibo 5/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-GT-651',
    folio: 'GT-651',
    client: 'GT',
    total: 106477.56,
    issueDateStr: '2026-06-29',
    dueDateStr: '2026-07-29',
    status: 'pending',
    contrarecibo: 'GT-651',
    contrareciboDateStr: '2026-06-29',
    notes: 'Contrarecibo 6/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-TH-713',
    folio: 'TH-713',
    client: 'TH',
    total: 108647.46,
    issueDateStr: '2026-06-29',
    dueDateStr: '2026-07-29',
    status: 'pending',
    contrarecibo: 'TH-713',
    contrareciboDateStr: '2026-06-29',
    notes: 'Contrarecibo 7/11 - Generado',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-GT-624',
    folio: 'GT-624',
    client: 'GT',
    total: 98136.00,
    issueDateStr: '2026-06-22',
    dueDateStr: '2026-07-22',
    status: 'overdue',
    contrarecibo: 'GT-624',
    contrareciboDateStr: '2026-06-22',
    notes: 'Contrarecibo 8/11 - Generado (Vencido)',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-TH-680',
    folio: 'TH-680',
    client: 'TH',
    total: 80970.38,
    issueDateStr: '2026-06-22',
    dueDateStr: '2026-07-22',
    status: 'overdue',
    contrarecibo: 'TH-680',
    contrareciboDateStr: '2026-06-22',
    notes: 'Contrarecibo 9/11 - Generado (Vencido)',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-GT-597',
    folio: 'GT-597',
    client: 'GT',
    total: 107420.76,
    issueDateStr: '2026-06-15',
    dueDateStr: '2026-07-15',
    status: 'overdue',
    contrarecibo: 'GT-597',
    contrareciboDateStr: '2026-06-15',
    notes: 'Contrarecibo 10/11 - Generado (Vencido)',
    origin: 'base_inicial_contrarecibos'
  },
  {
    id: 'seed-GT-535',
    folio: 'GT-535',
    client: 'GT',
    total: 196482.30,
    issueDateStr: '2026-06-01',
    dueDateStr: '2026-07-01',
    status: 'overdue',
    contrarecibo: 'GT-535',
    contrareciboDateStr: '2026-06-01',
    notes: 'Contrarecibo 11/11 - Generado (Vencido)',
    origin: 'base_inicial_contrarecibos'
  },

  // 3 Facturas Pendientes de Contrarecibo
  {
    id: 'seed-FAC-6098',
    folio: '6098',
    client: 'GTP930115PU1 (Grupo Textil Providencia)',
    total: 27260.00,
    issueDateStr: '2026-07-27',
    dueDateStr: '2026-08-26',
    status: 'pending',
    notes: 'Pedido 120267113902 · CFDI 4.0 Ingreso (6098) · Pendiente de contrarecibo',
    origin: 'facturas_pendientes_contrarecibo'
  },
  {
    id: 'seed-FAC-6097',
    folio: '6097',
    client: 'GTP930115PU1 (Grupo Textil Providencia)',
    total: 109040.00,
    issueDateStr: '2026-07-27',
    dueDateStr: '2026-08-26',
    status: 'pending',
    notes: 'Pedido 120267113870 · CFDI 4.0 Ingreso (6097) · Pendiente de contrarecibo',
    origin: 'facturas_pendientes_contrarecibo'
  },
  {
    id: 'seed-FAC-6084',
    folio: '6084',
    client: 'GTP930115PU1 (Grupo Textil Providencia)',
    total: 106720.17,
    issueDateStr: '2026-07-20',
    dueDateStr: '2026-08-19',
    status: 'pending',
    notes: 'Pedido 120267113870 · CFDI 4.0 Ingreso (6084) · Pendiente de contrarecibo',
    origin: 'facturas_pendientes_contrarecibo'
  }
];

export async function seedInitialDatabase() {
  const batch = writeBatch(db);
  const cfg = DEFAULT_CONFIG;

  INITIAL_SEED_DATA.forEach((item) => {
    const subtotal = item.total / (1 + cfg.ivaRate);
    const kilos = Math.round(subtotal / cfg.salePricePerKg);

    const issueDate = new Date(`${item.issueDateStr}T00:00:00`);
    const dueDate = new Date(`${item.dueDateStr}T00:00:00`);
    const crDate = item.contrareciboDateStr ? new Date(`${item.contrareciboDateStr}T00:00:00`) : null;

    let dept = 'General';
    if (item.client === 'TH' || item.client === 'GT') {
      dept = item.client;
    } else if (item.folio.startsWith('TH') || item.folio.startsWith('GT')) {
      dept = item.folio.substring(0, 2);
    }

    batch.set(doc(db, PATHS.orders, item.id), {
      folio: item.folio,
      client: 'Grupo Textil Providencia',
      department: dept,
      provider: 'Andres',
      totalKilograms: kilos,
      kilosEstimados: true,
      financials: computeFinancials(kilos, cfg),
      creditCycle: {
        status: item.status,
        issueDate: Timestamp.fromDate(issueDate),
        dueDate: Timestamp.fromDate(dueDate),
      },
      collection: {
        contrareciboNumber: item.contrarecibo ?? '',
        contrareciboDate: crDate ? Timestamp.fromDate(crDate) : null,
        paidAmount: 0,
        paidAt: null,
        notes: item.notes ?? '',
      },
      processedAt: serverTimestamp(),
      origin: item.origin,
    });
  });

  await batch.commit();
}
