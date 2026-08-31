import { describe, it, expect } from 'vitest';
import { validarTamanoExcel, MAX_XLSX_IMPORT_MB } from '../xlsxSafety';

function makeFakeFile(sizeBytes: number): File {
  // jsdom's File constructor no calcula 'size' a partir del contenido real
  // en todos los entornos, así que se define directamente con Object.defineProperty.
  const file = new File([''], 'prueba.xlsx');
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('validarTamanoExcel', () => {
  it('acepta un archivo dentro del límite', () => {
    const file = makeFakeFile(1 * 1024 * 1024); // 1 MB
    expect(validarTamanoExcel(file)).toBeNull();
  });

  it('acepta un archivo justo en el límite', () => {
    const file = makeFakeFile(MAX_XLSX_IMPORT_MB * 1024 * 1024);
    expect(validarTamanoExcel(file)).toBeNull();
  });

  it('rechaza un archivo que excede el límite', () => {
    const file = makeFakeFile((MAX_XLSX_IMPORT_MB + 1) * 1024 * 1024);
    const err = validarTamanoExcel(file);
    expect(err).not.toBeNull();
    expect(err).toContain('MB');
  });
});

describe('buildOfficialExcelWorkbook', () => {
  it('construye un libro de Excel con las 3 hojas oficiales (Captura, Catálogo e Instructivo)', async () => {
    const { buildOfficialExcelWorkbook } = await import('../excelTemplateGenerator');
    const wb = buildOfficialExcelWorkbook();

    expect(wb).not.toBeNull();
    expect(wb.SheetNames).toContain('📦 Captura Expedientes');
    expect(wb.SheetNames).toContain('🏢 Catálogo & Precios');
    expect(wb.SheetNames).toContain('📖 Instructivo');
  });
});

describe('buildPrefacturaWorkbook (Generador Oficial de Prefacturas)', () => {
  it('genera correctamente el libro de Excel para la Prefactura de Evelia (Planta 4 - 1,972.20 kg)', async () => {
    const { buildPrefacturaWorkbook } = await import('../excelTemplateGenerator');
    const wb = buildPrefacturaWorkbook({
      clientName: 'GRUPO TEXTIL PROVIDENCIA (GT - Evelia / P4)',
      clientRfc: 'GTP930115PU1',
      clientAddress: 'HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO',
      clientUsoCfdi: 'Uso CFDI: G01 - Adquisición de mercancias',
      oc: '12026439713',
      notaCondiciones: 'OC 12026439713',
      items: [
        { kilos: 998.20, description: 'EGBO000017-SC BOLSA POLIETILENO 1.20 M X 1.60 M (80+40X160) _Sin Color', unitPrice: 43.0 },
        { kilos: 974.00, description: 'EGBO000093-SC BOLSA POLIETILENO 100 X 95 CM (60+40X95) _Sin Color', unitPrice: 43.0 },
      ],
      metodoPago: 'PPD',
      formaPago: '99 por definir',
      claveSat: '24141500',
      unidadSat: 'KGM',
    });

    expect(wb).not.toBeNull();
    expect(wb.SheetNames).toContain('Prefactura');
    const ws = wb.Sheets['Prefactura'];
    expect(ws).toBeDefined();
  });

  it('genera correctamente el libro de Excel para la Prefactura de Nava (Textil Hogar - 2,945.20 kg)', async () => {
    const { buildPrefacturaWorkbook } = await import('../excelTemplateGenerator');
    const wb = buildPrefacturaWorkbook({
      clientName: 'TEXTIL HOGAR (TH - NAVA)',
      clientRfc: 'GTP930115PU1',
      clientAddress: 'HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO',
      clientUsoCfdi: 'Uso CFDI: G01 - Adquisición de mercancias',
      oc: '120267114114',
      notaCondiciones: 'OC 120267114114',
      items: [
        { kilos: 1445.20, description: 'enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM (55x77) _Sin Color', unitPrice: 43.0 },
        { kilos: 500.00, description: 'enbo000044-sc BOLSA POLIETILENO 30 X 40 CM', unitPrice: 43.0 },
        { kilos: 1000.00, description: 'ENBO000007-SC BOLSA POLIETILENO 50 CM x 55 CM _Sin Color', unitPrice: 43.0 },
      ],
      metodoPago: 'PPD',
      formaPago: '99 por definir',
      claveSat: '24141500',
      unidadSat: 'KGM',
    });

    expect(wb).not.toBeNull();
    expect(wb.SheetNames).toContain('Prefactura');
  });
});

