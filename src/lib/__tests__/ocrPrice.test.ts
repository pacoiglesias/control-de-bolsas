import { describe, it, expect } from 'vitest';
import { detectDocumentUnitPrice, dominantItemUnitPrice } from '../ocrPrice';
import { parseOcrData } from '../ocr';

describe('detectDocumentUnitPrice', () => {
  it('usa el precio dominante de los conceptos', () => {
    expect(
      detectDocumentUnitPrice('', 0, 0, [
        { valorUnitario: 44 },
        { valorUnitario: 44 },
        { valorUnitario: 43 },
      ])
    ).toBe(44);
  });

  it('detecta el precio repetido en el texto ($44 tres veces)', () => {
    const text = [
      '500.00 KGM-KILOGRAMO egbo000103-sc BULTO $ 44.00 $ 22,000.00',
      '575.00 KGM-KILOGRAMO enbo000006-sc BOLSA $ 44.00 $ 25,300.00',
      '250.00 KGM-KILOGRAMO ENBO000007-SC BOLSA $ 44.00 $ 11,000.00',
      'SUBTOTAL $ 58,300.00',
    ].join('\n');
    expect(detectDocumentUnitPrice(text, 1325, 58300, [])).toBe(44);
  });

  it('devuelve null si no hay precio detectable', () => {
    expect(detectDocumentUnitPrice('sin precios aquí', 100, 4300, [])).toBeNull();
  });

  it('ignora importes grandes aunque se repitan', () => {
    const text = 'TOTAL $ 22,000.00 TOTAL $ 22,000.00 $ 44.00 $ 44.00';
    expect(detectDocumentUnitPrice(text, 1000, 44000, [])).toBe(44);
  });
});

describe('dominantItemUnitPrice', () => {
  it('devuelve el precio más frecuente de las partidas', () => {
    expect(
      dominantItemUnitPrice([
        { unitPrice: 44 },
        { unitPrice: 44 },
        { unitPrice: 43 },
      ])
    ).toBe(44);
    expect(dominantItemUnitPrice([])).toBeNull();
    expect(dominantItemUnitPrice([{ unitPrice: 0 }])).toBeNull();
  });
});

describe('parseOcrData: factura 6438 a $44 (regresión del bug del 43 fijo)', () => {
  // Texto representativo de la factura 6438 real: 500 + 575 + 250 kg a
  // $44, subtotal $58,300. Con el divisor fijo de $43, la corroboración
  // dejaba 1,355.81 kg; con el precio real debe quedar en 1,325 kg.
  const texto6438 = [
    'ELEMENTAL DENIM Factura 6438 EDE1902136T2',
    'GRUPO TEXTIL PROVIDENCIA GTP930115PU1',
    '500.00 KGM-KILOGRAMO egbo000103-sc BULTO 80 X 20 +20 X 160 *250 $ 44.00 $ 22,000.00',
    '575.00 KGM-KILOGRAMO enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM $ 44.00 $ 25,300.00',
    '250.00 KGM-KILOGRAMO ENBO000007-SC BOLSA POLIETILENO 50 CM x 55 CM $ 44.00 $ 11,000.00',
    'SUBTOTAL $ 58,300.00',
    'TOTAL $ 67,628.00',
  ].join('\n');

  it('deja 1,325 kg, no 1,355.81 kg', () => {
    const r = parseOcrData(texto6438);
    expect(r.kilos).toBe(1325);
    expect(r.subTotal).toBe(58300);
  });

  it('un documento a $43 sigue funcionando igual', () => {
    const texto43 = [
      '500.00 KGM-KILOGRAMO EGBO000017-SC BOLSA $ 43.00 $ 21,500.00',
      '500.00 KGM-KILOGRAMO EGBO000095-SC BOLSA $ 43.00 $ 21,500.00',
      'SUBTOTAL $ 43,000.00',
    ].join('\n');
    const r = parseOcrData(texto43);
    expect(r.kilos).toBe(1000);
  });

  it('kilos incompletos se corrigen con el precio real ($44)', () => {
    // Solo se detectan 500 kg pero el subtotal es de 1,000 kg a $44.
    const textoIncompleto = [
      '500.00 KGM-KILOGRAMO EGBO000017-SC BOLSA $ 44.00 $ 22,000.00',
      'OTRO RENGLON SIN MARCA KGM $ 44.00 $ 22,000.00',
      'SUBTOTAL $ 44,000.00',
    ].join('\n');
    const r = parseOcrData(textoIncompleto);
    expect(r.kilos).toBe(1000);
  });
});
