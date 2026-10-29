import { describe, it, expect } from 'vitest';
import {
  parseComplementPayments,
  applyComplementPayment,
  receiptKeyForComplement,
  refreshOrderPaymentTotals,
  type InvoiceLike,
} from '../../../functions/src/handlers/complementPayments';

const COMP_UUID = '9E5351A7-56D9-42F1-8D84-54C5A60C3486';
const INV_UUID = '18633874-6993-4EDD-9278-52BCCADB1054';

function pagoDoc() {
  return {
    'cfdi:Complemento': {
      'pago20:Pagos': {
        'pago20:Pago': {
          FechaPago: '2026-10-23',
          'pago20:DoctoRelacionado': {
            IdDocumento: INV_UUID.toLowerCase(),
            ImpPagado: '30000',
            ImpSaldoInsoluto: '39832',
          },
        },
      },
      'tfd:TimbreFiscalDigital': { UUID: COMP_UUID.toLowerCase() },
    },
  };
}

function invoice(over: Partial<InvoiceLike> = {}): InvoiceLike {
  return {
    id: 'inv-1',
    uuid: INV_UUID,
    folio: '6437',
    kilos: 1400,
    creditCycle: { status: 'manual_review' },
    financials: { invoiceTotal: 69832, saleTotal: 60200 },
    collection: {},
    ...over,
  };
}

describe('parseComplementPayments', () => {
  it('extrae UUID, montos y fecha de un pago20', () => {
    const doc = parseComplementPayments(pagoDoc());
    expect(doc.uuid).toBe(COMP_UUID);
    expect(doc.fechaPago).toBe('2026-10-23');
    expect(doc.payments).toEqual([
      { uuid: INV_UUID, impPagado: 30000, impSaldoInsoluto: 39832 },
    ]);
  });

  it('acepta pago10 y varios DoctoRelacionado', () => {
    const doc = parseComplementPayments({
      'cfdi:Complemento': {
        'pago10:Pagos': {
          'pago10:Pago': [
            {
              FechaPago: '2026-10-24',
              'pago10:DoctoRelacionado': [
                { IdDocumento: 'AAA', ImpPagado: '100', ImpSaldoInsoluto: '0' },
                { IdDocumento: 'BBB', ImpPagado: '50' },
              ],
            },
          ],
        },
      },
    });
    expect(doc.payments).toHaveLength(2);
    expect(doc.payments[1].impSaldoInsoluto).toBeNull();
  });

  it('lanza sin nodo de Pago', () => {
    expect(() => parseComplementPayments({ 'cfdi:Complemento': {} })).toThrow(
      'sin nodo de Pago'
    );
  });
});

describe('applyComplementPayment', () => {
  it('liquida total: paid, paidAmount y paidAt', () => {
    const r = applyComplementPayment(
      invoice(),
      { uuid: INV_UUID, impPagado: 69832, impSaldoInsoluto: 0 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    expect(r.applied).toBe(true);
    expect(r.settled).toBe(true);
    expect(r.invoice.creditCycle?.status).toBe('paid');
    expect(r.invoice.collection?.paidAmount).toBe(69832);
    expect(r.invoice.collection?.paidAt).toBe('2026-10-23');
    expect(r.invoice.collection?.complementStatus).toBe('issued');
    expect(r.receiptKey).toBe(`CFDI_${COMP_UUID}_inv-1`);
    expect(r.invoice.collection?.paymentsHistory).toHaveLength(1);
  });

  it('parcial: in_review, acumula sin paidAt', () => {
    const r = applyComplementPayment(
      invoice(),
      { uuid: INV_UUID, impPagado: 30000, impSaldoInsoluto: 39832 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    expect(r.applied).toBe(true);
    expect(r.settled).toBe(false);
    expect(r.invoice.creditCycle?.status).toBe('in_review');
    expect(r.invoice.collection?.paidAmount).toBe(30000);
    expect(r.invoice.collection?.paidAt).toBeUndefined();
  });

  it('dos abonos secuenciales liquidan sin duplicar', () => {
    const first = applyComplementPayment(
      invoice(),
      { uuid: INV_UUID, impPagado: 30000, impSaldoInsoluto: 39832 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    const second = applyComplementPayment(
      first.invoice,
      { uuid: INV_UUID, impPagado: 39832, impSaldoInsoluto: 0 },
      'OTRO-COMPLEMENTO-UUID',
      '2026-10-29',
      new Set()
    );
    expect(second.invoice.creditCycle?.status).toBe('paid');
    expect(second.invoice.collection?.paidAmount).toBe(69832);
    expect(second.invoice.collection?.paymentsHistory).toHaveLength(2);
  });

  it('reproceso del mismo complemento: duplicado, no duplica el monto', () => {
    const key = receiptKeyForComplement(COMP_UUID, 'inv-1');
    const r = applyComplementPayment(
      invoice({ collection: { paidAmount: 30000 } }),
      { uuid: INV_UUID, impPagado: 30000, impSaldoInsoluto: 39832 },
      COMP_UUID,
      '2026-10-23',
      new Set([key])
    );
    expect(r.applied).toBe(false);
    expect(r.skippedReason).toBe('duplicate');
    expect(r.invoice.collection?.paidAmount).toBe(30000);
  });

  it('no aplica sobre factura ya liquidada ni sobrepagos', () => {
    const settled = applyComplementPayment(
      invoice({ creditCycle: { status: 'paid' }, collection: { paidAmount: 69832 } }),
      { uuid: INV_UUID, impPagado: 100, impSaldoInsoluto: 0 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    expect(settled.skippedReason).toBe('already_settled');
    const over = applyComplementPayment(
      invoice({ collection: { paidAmount: 60000 } }),
      { uuid: INV_UUID, impPagado: 20000, impSaldoInsoluto: 0 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    expect(over.skippedReason).toBe('overpayment');
    expect(over.invoice.collection?.paidAmount).toBe(60000);
  });

  it('sin total: marca issued pero no inventa montos', () => {
    const r = applyComplementPayment(
      invoice({ financials: undefined }),
      { uuid: INV_UUID, impPagado: 100, impSaldoInsoluto: 0 },
      COMP_UUID,
      '2026-10-23',
      new Set()
    );
    expect(r.applied).toBe(false);
    expect(r.skippedReason).toBe('no_total');
    expect(r.invoice.collection?.complementStatus).toBe('issued');
    expect(r.paidAmount).toBe(0);
    // No se inventa un paidAmount en la factura: queda ausente, no en cero.
    expect(r.invoice.collection?.paidAmount).toBeUndefined();
  });
});

describe('refreshOrderPaymentTotals', () => {
  it('suma abonos y detecta liquidación total', () => {
    expect(
      refreshOrderPaymentTotals([
        invoice({ creditCycle: { status: 'paid' }, collection: { paidAmount: 100 } }),
        invoice({ id: 'inv-2', creditCycle: { status: 'in_review' }, collection: { paidAmount: 50 } }),
      ])
    ).toEqual({ paidAmount: 150, allSettled: false });
    expect(
      refreshOrderPaymentTotals([
        invoice({ creditCycle: { status: 'paid' }, collection: { paidAmount: 100 } }),
      ])
    ).toEqual({ paidAmount: 100, allSettled: true });
  });
});
