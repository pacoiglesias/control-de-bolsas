import { describe, it, expect } from 'vitest';
import { parseScaleTicket, matchScaleTicketWithOrders, distributeKilosAcrossItems } from '../scaleTicketParser';

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

describe('distributeKilosAcrossItems (Reparto Inteligente Multipartida)', () => {
  const items = [
    { id: 'item-1', code: 'EGBO000018-SC', description: 'BOLSA 40X60', quantity: 2000 },
    { id: 'item-2', code: 'EGBO000094-SC', description: 'BOLSA 50X70', quantity: 1500 },
    { id: 'item-3', code: 'EGBO000095-SC', description: 'BOLSA 60X90', quantity: 1500 },
  ];

  it('distribuye secuencialmente llenando partidas pendientes', () => {
    // 2,500 kg deben llenar los 2,000 kg de item-1 y 500 kg de item-2
    const allocations = distributeKilosAcrossItems(2500, items, {});

    expect(allocations).toHaveLength(3);
    expect(allocations[0].allocatedKg).toBe(2000);
    expect(allocations[0].remainingAfterKg).toBe(0);

    expect(allocations[1].allocatedKg).toBe(500);
    expect(allocations[1].remainingAfterKg).toBe(1000);

    expect(allocations[2].allocatedKg).toBe(0);
    expect(allocations[2].remainingAfterKg).toBe(1500);
  });

  it('toma en cuenta entregas previas por partida al calcular faltantes', () => {
    // item-1 ya tiene 1,500 kg entregados (le faltan 500 kg)
    const prevDeliveries = {
      'item-1': 1500,
    };

    // Entrega de 1,200 kg: 500 kg van a item-1 (para completarlo), y 700 kg van a item-2
    const allocations = distributeKilosAcrossItems(1200, items, prevDeliveries);

    expect(allocations[0].previouslyDeliveredKg).toBe(1500);
    expect(allocations[0].pendingKg).toBe(500);
    expect(allocations[0].allocatedKg).toBe(500);
    expect(allocations[0].remainingAfterKg).toBe(0);

    expect(allocations[1].allocatedKg).toBe(700);
    expect(allocations[1].remainingAfterKg).toBe(800);
  });

  it('asigna el 100% a la única partida si solo hay 1 producto', () => {
    const singleItem = [
      { id: 'it-single', code: 'EGBO000018-SC', description: 'BOLSA UNICA', quantity: 5000 },
    ];
    const allocations = distributeKilosAcrossItems(3200, singleItem, {});

    expect(allocations).toHaveLength(1);
    expect(allocations[0].allocatedKg).toBe(3200);
    expect(allocations[0].remainingAfterKg).toBe(1800);
  });
});

describe('scaleTicketParser Multipartidas en texto OCR', () => {
  it('detecta múltiples renglones de partidas con sus respectivos kilos', () => {
    const rawMultipartidaTicket = `
      GRUPO TEXTIL PROVIDENCIA SA DE CV
      ORDEN DE ENTREGA - BASCULA
      OC: 12026439784
      FOLIO: 6439784
      FECHA: 28/09/2026
      
      PARTIDA 1: EGBO000018-SC BOLSA 40X60  1,000.00 KG
      PARTIDA 2: EGBO000094-SC BOLSA 50X70    500.00 KG
      PARTIDA 3: EGBO000095-SC BOLSA 60X90    500.00 KG
      
      PESO TOTAL NETO: 2,000.00 KG
    `;

    const parsed = parseScaleTicket(rawMultipartidaTicket);
    expect(parsed.kilosNeto).toBe(2000);
    expect(parsed.ticketFolio).toBe('6439784');
    expect(parsed.detectedPartidas).toBeDefined();
    expect(parsed.detectedPartidas?.length).toBeGreaterThanOrEqual(3);
    expect(parsed.detectedPartidas?.some((p) => p.code === 'EGBO000018-SC' && p.kilos === 1000)).toBe(true);
  });
});
