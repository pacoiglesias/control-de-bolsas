import { describe, it, expect } from 'vitest';
import { computeFinancials } from '../finance';
import { DEFAULT_CONFIG } from '../types';

describe('Mejora 2: Flujo Unificado (Wizard) y Conciliación 3-Way', () => {
  it('calcula las finanzas del flujo unificado a partir de datos de OC y Báscula', () => {
    const kilosPesados = 2050; // Ligera variación en báscula
    const precioVenta = 43;
    const costoAndres = 38;

    const fin = computeFinancials(kilosPesados, {
      ...DEFAULT_CONFIG,
      salePricePerKg: precioVenta,
      costPricePerKg: costoAndres,
    });

    // Subtotal = 2050 * 43 = 88,150
    expect(fin.saleTotal).toBe(88150);
    // Costo Andrés = 2050 * 38 = 77,900
    expect(fin.costTotal).toBe(77900);
    // Comisión contador (8% sobre subtotal) = 88150 * 0.08 = 7,052
    expect(fin.commission).toBe(7052);
    // Total con IVA (16%) = 88150 * 1.16 = 102,254
    expect(fin.invoiceTotal).toBe(102254);
    // Flujo neto esperado
    expect(fin.netCashFlow).toBeGreaterThan(0);
  });

  it('valida la estructura del expediente unificado generado por el Wizard', () => {
    const ocData = {
      folio: 'OC-9901',
      client: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)',
      department: 'TH',
      productDescription: 'Bolsa de Polietileno Transparente en Rollo',
      totalKilograms: 1500,
      salePricePerKg: 43,
      costPricePerKg: 38,
      creditDays: 30,
    };

    const recepcionData = {
      remisionNumber: 'REM-5541',
      receivedKilos: 1500,
      deliveryDate: '2026-09-05',
      driverName: 'Carlos M.',
      vehiclePlates: 'TL-9912',
      qualityPassed: true,
    };

    const facturaData = {
      folioFactura: 'F-7712',
      uuidFiscal: 'A1B2C3D4-E5F6-7890',
      total: 74820,
      subtotal: 64500,
      contrarecibo: 'CR-8821',
      paymentMethod: 'PPD',
    };

    // Estructura esperada en Firestore
    const expediente = {
      folio: ocData.folio,
      client: ocData.client,
      department: 'TH-ALMACEN-1',
      totalKilograms: recepcionData.receivedKilos,
      status: 'facturado',
      deliveries: [
        {
          remision: recepcionData.remisionNumber,
          kilos: recepcionData.receivedKilos,
          driver: recepcionData.driverName,
        },
      ],
      invoices: [
        {
          folio: facturaData.folioFactura,
          uuid: facturaData.uuidFiscal,
          kilos: recepcionData.receivedKilos,
          collection: {
            contrareciboNumber: facturaData.contrarecibo,
          },
        },
      ],
      wizardCreated: true,
    };

    expect(expediente.status).toBe('facturado');
    expect(expediente.deliveries).toHaveLength(1);
    expect(expediente.invoices).toHaveLength(1);
    expect(expediente.invoices[0].collection.contrareciboNumber).toBe('CR-8821');
  });
});
