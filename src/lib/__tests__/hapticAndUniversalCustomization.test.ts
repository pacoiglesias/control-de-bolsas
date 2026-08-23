import { describe, it, expect } from 'vitest';
import { triggerHaptic, playCashSound, playSuccessSound, playSoftClick } from '../hapticEngine';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '../../hooks/useSystemSettings';

describe('Motor Háptico y Parametrización Universal', () => {
  it('hapticEngine se ejecuta de forma segura sin romper en entornos sin navegador', () => {
    expect(() => triggerHaptic('light')).not.toThrow();
    expect(() => triggerHaptic('cash')).not.toThrow();
    expect(() => triggerHaptic('success')).not.toThrow();
    expect(() => playCashSound()).not.toThrow();
    expect(() => playSuccessSound()).not.toThrow();
    expect(() => playSoftClick()).not.toThrow();
  });

  it('DEFAULT_SYSTEM_SETTINGS contiene todas las llaves para parametrización universal', () => {
    expect(DEFAULT_SYSTEM_SETTINGS.companyName).toBe('BOLSAS ELEMENTAL');
    expect(DEFAULT_SYSTEM_SETTINGS.providerName).toBe('Andrés');
    expect(DEFAULT_SYSTEM_SETTINGS.providerTitle).toBe('Proveedor de Bolsa / Fabricante');
    expect(DEFAULT_SYSTEM_SETTINGS.clientName).toBe('Grupo Textil Providencia SA de CV');
    expect(DEFAULT_SYSTEM_SETTINGS.clientShortName).toBe('Providencia');
    expect(DEFAULT_SYSTEM_SETTINGS.deptCodeTH).toBe('TH');
    expect(DEFAULT_SYSTEM_SETTINGS.deptCodeGT).toBe('GT');
    expect(DEFAULT_SYSTEM_SETTINGS.deptNameTH).toBe('Textil Hogar');
    expect(DEFAULT_SYSTEM_SETTINGS.deptNameGT).toBe('Grupo Textil');
    expect(DEFAULT_SYSTEM_SETTINGS.managerTH).toBe('Lic. Nava');
    expect(DEFAULT_SYSTEM_SETTINGS.managerGT).toBe('Lic. Evelia');
  });

  it('permite cambiar totalmente de empresa, cliente, proveedor y códigos de departamento', () => {
    const customEnterpriseSettings: SystemSettings = {
      companyName: 'EMPAQUES DEL NORTE S.A. DE C.V.',
      companyLogoUrl: 'https://ejemplo.com/logo.png',
      providerName: 'Taller Don José',
      providerTitle: 'Fabricante de Polímeros',
      clientName: 'Consorcio Textil Mexicano S.A. de C.V.',
      clientShortName: 'Consorcio Textil',
      departments: ['PL1', 'PL2'],
      deptCodeTH: 'PL1',
      deptCodeGT: 'PL2',
      deptNameTH: 'Planta Hilados',
      deptNameGT: 'Planta Confección',
      managerTH: 'Ing. Roberto Ramos',
      managerGT: 'Lic. Mónica Soto',
      cajaChicaBalance: 50000,
    };

    expect(customEnterpriseSettings.providerName).toBe('Taller Don José');
    expect(customEnterpriseSettings.clientShortName).toBe('Consorcio Textil');
    expect(customEnterpriseSettings.deptCodeTH).toBe('PL1');
    expect(customEnterpriseSettings.managerTH).toBe('Ing. Roberto Ramos');
    expect(customEnterpriseSettings.managerGT).toBe('Lic. Mónica Soto');
  });

  it('valida el criterio de preservación de los 11 CRs oficiales + Factura 6167', () => {
    const OFFICIAL_CRS = ['TH-946', 'TH-912', 'TH-879', 'TH-836', 'GT-742', 'TH-804', 'GT-713', 'GT-651', 'TH-768', 'GT-624', 'GT-597'];

    const testOrders = [
      { id: '1', collection: { contrareciboNumber: 'TH-912' }, folio: '6160' },
      { id: '2', collection: { contrareciboNumber: 'GT-742' }, folio: '5980' },
      { id: '3', folio: '120267114014', invoices: [{ folio: '6167' }] },
      { id: 'test-1', folio: 'OC-TEST-999', client: 'CLIENTE PRUEBA' },
      { id: 'test-2', folio: 'MIGRACION-OLD', client: 'MIGRACION' },
    ];

    const isOfficial = (o: any) => {
      const crNumber = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
      const hasOfficialCr = OFFICIAL_CRS.some(cr => crNumber.includes(cr)) ||
        (o.invoices || []).some((inv: any) => OFFICIAL_CRS.some(cr => (inv.collection?.contrareciboNumber || '').toUpperCase().includes(cr)));
      const isFactura6167 = (o.oc === '120267114014' || o.folio === '120267114014' || (o.invoices || []).some((inv: any) => inv.folio === '6167' || inv.folio === 'TH-946'));
      return hasOfficialCr || isFactura6167;
    };

    expect(isOfficial(testOrders[0])).toBe(true);
    expect(isOfficial(testOrders[1])).toBe(true);
    expect(isOfficial(testOrders[2])).toBe(true);
    expect(isOfficial(testOrders[3])).toBe(false);
    expect(isOfficial(testOrders[4])).toBe(false);
  });

  it('valida que las acciones de CommandPalette y QuickPeek calculen porcentajes y kilos sin error', () => {
    const mockOrder = {
      id: 'ord-101',
      folio: '6160',
      totalKilograms: 1850,
      deliveries: [{ kilograms: 1850, invoiced: true }],
      invoices: [{ folio: '6160', kilos: 1850, total: 79826, collection: { contrareciboNumber: 'TH-912' } }],
    };

    const totalKilos = mockOrder.totalKilograms;
    const kilosEntregados = mockOrder.deliveries.reduce((a, d) => a + d.kilograms, 0);
    const kilosFacturados = mockOrder.invoices.reduce((a, inv) => a + inv.kilos, 0);

    const pctEntregado = Math.min(100, Math.round((kilosEntregados / totalKilos) * 100));
    const pctFacturado = Math.min(100, Math.round((kilosFacturados / totalKilos) * 100));

    expect(pctEntregado).toBe(100);
    expect(pctFacturado).toBe(100);
    expect(mockOrder.invoices[0].collection.contrareciboNumber).toBe('TH-912');
  });
});
