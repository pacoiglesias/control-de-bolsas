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
