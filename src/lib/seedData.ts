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
  items?: any[];
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
  },
  {
    id: 'seed-FAC-120267114014',
    folio: '120267114014',
    client: 'GTP930115PU1 (Grupo Textil Providencia)',
    total: 141000.00,
    issueDateStr: '2026-07-23',
    dueDateStr: '2026-08-22',
    status: 'pedido',
    notes: 'PEDIDO DE MATERIAL PARA PROGRAMAS COPPEL/WALMART/LIVERPOOL',
    origin: 'base_inicial_ordenes',
    items: [
      {
        id: 'item-1',
        code: 'enbo000006-sc',
        description: 'BOLSA POLIETILENO 77 CM X 55 CM _Sin Color',
        quantity: 1000,
        deliveredQuantity: 983.46,
        unit: 'PZA',
        unitPrice: 47.00,
        amount: 47000.00
      },
      {
        id: 'item-2',
        code: 'egbo000103-sc',
        description: 'BULTO 80 X 20 +20 X 160 *250',
        quantity: 1000,
        deliveredQuantity: 1000.00,
        unit: 'PZA',
        unitPrice: 47.00,
        amount: 47000.00
      },
      {
        id: 'item-3',
        code: 'egbo000107-sc',
        description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250',
        quantity: 1000,
        deliveredQuantity: 980.70,
        unit: 'PZA',
        unitPrice: 47.00,
        amount: 47000.00
      }
    ]
  }
];

export const INITIAL_EXPENSES = [
  { id: 'seed-exp-1', dateStr: '2026-07-01', concept: 'saldo nuestra caja chica', amount: -819.44, type: 'egreso' },
  { id: 'seed-exp-2', dateStr: '2026-07-15', concept: 'recibimos pago dinero ingresa en csaja chica', amount: 144945, type: 'ingreso' },
  { id: 'seed-exp-3', dateStr: '2026-07-20', concept: 'deuda con andres es negativo para nosotros porque', amount: -125175.56, type: 'egreso', provider: 'Andres' },
  { id: 'seed-exp-4', dateStr: '2026-07-21', concept: 'adelanto andres 21 julio', amount: 145000, type: 'egreso', provider: 'Andres' },
  { id: 'seed-exp-5', dateStr: '2026-07-23', concept: 'recibimos el dinero 23 de julio ingresa en caja chica', amount: 76140, type: 'ingreso' }
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
      items: (item as any).items || [],
      processedAt: serverTimestamp(),
      origin: item.origin,
    });
    
    // Add items to products catalog if they exist
    if ((item as any).items) {
      (item as any).items.forEach((it: any) => {
        const productId = it.code?.trim() ? it.code.trim().toUpperCase() : it.description.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
        batch.set(doc(db, PATHS.products, productId), {
          code: it.code?.trim() || null,
          description: it.description.trim(),
          unit: it.unit,
          defaultPrice: it.unitPrice,
          lastOrderDate: serverTimestamp(),
        }, { merge: true });
      });
    }
  });

  INITIAL_EXPENSES.forEach((exp) => {
    batch.set(doc(db, PATHS.expenses, exp.id), {
      date: Timestamp.fromDate(new Date(`${exp.dateStr}T12:00:00`)),
      concept: exp.concept,
      amount: Math.abs(exp.amount),
      type: exp.type,
      provider: (exp as any).provider || null,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
