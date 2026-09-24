import { describe, it, expect } from 'vitest';
import { parseScaleTicket, matchScaleTicketWithOrders } from '../scaleTicketParser';

describe('scaleTicketParser (Báscula Patio Providencia y Tickets de Pesaje)', () => {
  it('extrae correctamente el Peso Neto explícito, ticket, fecha y placas', () => {
    const rawTicket = `
      GRUPO TEXTIL PROVIDENCIA SA DE CV
      PLANTA 4 - BASCULA DE PATIO
      TICKET NO: 45892
      FECHA: 24/09/2026 14:32:10
      VEHICULO / PLACAS: XA-3849-B
      CHOFER: JUAN CARLOS PEREZ
      PRODUCTO: BOLSA DE POLIETILENO TRANSPARENTE
      
      PESO BRUTO:  14,580.00 KG
      TARA:        12,580.00 KG
      PESO NETO:    2,000.00 KG
    `;

    const result = parseScaleTicket(rawTicket);
    expect(result.kilosNeto).toBe(2000);
    expect(result.kilosBruto).toBe(14580);
    expect(result.kilosTara).toBe(12580);
    expect(result.ticketFolio).toBe('45892');
    expect(result.dateStr).toBe('2026-09-24');
    expect(result.placas).toBe('XA-3849-B');
    expect(result.confidence).toBe('high');
  });

  it('calcula Peso Neto cuando solo viene Bruto y Tara', () => {
    const rawTicket = `
      BASCULA SAN MARTIN
      BOLETA # 10893
      FECHA: 2026-09-18
      BRUTO: 15,250 KG
      TARA: 14,000 KG
    `;

    const result = parseScaleTicket(rawTicket);
    expect(result.kilosNeto).toBe(1250);
    expect(result.ticketFolio).toBe('10893');
    expect(result.dateStr).toBe('2026-09-18');
  });

  it('extrae kilos con notación decimal y formato abreviado P. NETO', () => {
    const rawTicket = `
      TEXTIL HOGAR - RECEPCION MATERIAL
      REMISIÓN: R-9941
      FECHA: 05-09-2026
      P. NETO: 987.50 KG
    `;

    const result = parseScaleTicket(rawTicket);
    expect(result.kilosNeto).toBe(987.5);
    expect(result.ticketFolio).toBe('R-9941');
    expect(result.dateStr).toBe('2026-09-05');
  });

  it('extrae número de OC, departamento y código de producto desde el ticket', () => {
    const rawTicket = `
      GRUPO TEXTIL PROVIDENCIA - PLANTA P4
      TICKET: 90214
      ORDEN DE COMPRA: 120267114302
      CODIGO: EGBO000095-SC
      BOLSA POLIETILENO 50X70
      PESO NETO: 2,000.00 KG
    `;

    const result = parseScaleTicket(rawTicket);
    expect(result.kilosNeto).toBe(2000);
    expect(result.detectedOc).toBe('120267114302');
    expect(result.detectedProductCodes).toContain('EGBO000095-SC');
    expect(result.detectedDepartment).toBe('GT');
  });
});

describe('matchScaleTicketWithOrders (Comparación Inteligente con OC)', () => {
  const mockOrders = [
    {
      id: 'ord-th-1',
      oc: '120267114302',
      folio: 'OC-71143',
      department: 'TH',
      client: 'TEXTIL HOGAR',
      totalKilograms: 10000,
      deliveries: [{ kilos: 2000 }], // 8,000 pendientes
      items: [
        { code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 50X70', quantity: 10000 },
      ],
    },
    {
      id: 'ord-gt-2',
      oc: '12026439784',
      folio: 'OC-43978',
      department: 'GT',
      client: 'GRUPO TEXTIL',
      totalKilograms: 5000,
      deliveries: [], // 5,000 pendientes
      items: [
        { code: 'ENBO000102-SC', description: 'BOLSA NEGRA 60X90', quantity: 5000 },
      ],
    },
  ];

  it('asigna automáticamente la OC correcta por número de OC detectado en el ticket', () => {
    const parsed = {
      rawText: 'ORDEN DE COMPRA: 120267114302\nPESO NETO: 3000 KG',
      kilosNeto: 3000,
      detectedOc: '120267114302',
      detectedProductCodes: [],
      confidence: 'high' as const,
    };

    const match = matchScaleTicketWithOrders(parsed, mockOrders);
    expect(match.suggestedOrderId).toBe('ord-th-1');
    expect(match.status).toBe('valid_partial');
    expect(match.orderPendingKg).toBe(8000);
    expect(match.remainingAfterTicketKg).toBe(5000);
    expect(match.matchedBy).toBe('oc_number');
  });

  it('asigna la OC correcta por código de producto cuando la OC no viene explícita', () => {
    const parsed = {
      rawText: 'CODIGO: ENBO000102-SC\nPESO NETO: 1500 KG',
      kilosNeto: 1500,
      detectedProductCodes: ['ENBO000102-SC'],
      confidence: 'medium' as const,
    };

    const match = matchScaleTicketWithOrders(parsed, mockOrders);
    expect(match.suggestedOrderId).toBe('ord-gt-2');
    expect(match.matchedBy).toBe('product_code');
    expect(match.matchedItem?.code).toBe('ENBO000102-SC');
    expect(match.remainingAfterTicketKg).toBe(3500);
  });

  it('detecta liquidación total (100% de la orden)', () => {
    const parsed = {
      rawText: 'ORDEN DE COMPRA: 120267114302\nPESO NETO: 8000 KG',
      kilosNeto: 8000,
      detectedOc: '120267114302',
      detectedProductCodes: [],
      confidence: 'high' as const,
    };

    const match = matchScaleTicketWithOrders(parsed, mockOrders);
    expect(match.suggestedOrderId).toBe('ord-th-1');
    expect(match.status).toBe('valid_completion');
    expect(match.remainingAfterTicketKg).toBe(0);
    expect(match.statusMessage).toContain('liquida al 100%');
  });

  it('emite alerta de exceso cuando el ticket supera el saldo pendiente de la OC', () => {
    const parsed = {
      rawText: 'ORDEN DE COMPRA: 120267114302\nPESO NETO: 9500 KG',
      kilosNeto: 9500, // Hay 8,000 pendientes
      detectedOc: '120267114302',
      detectedProductCodes: [],
      confidence: 'high' as const,
    };

    const match = matchScaleTicketWithOrders(parsed, mockOrders);
    expect(match.suggestedOrderId).toBe('ord-th-1');
    expect(match.status).toBe('over_delivery');
    expect(match.statusMessage).toContain('Alerta de Exceso');
    expect(match.statusMessage).toContain('+1,500');
  });
});
