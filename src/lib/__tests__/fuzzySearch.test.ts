import { describe, it, expect } from 'vitest';
import { levenshteinDistance, computeSimilarity, fuzzySearch } from '../fuzzySearch';

describe('Motor de Búsqueda Difusa (Fuzzy Search)', () => {
  it('calcula la distancia de Levenshtein correctamente', () => {
    expect(levenshteinDistance('gato', 'pato')).toBe(1);
    expect(levenshteinDistance('polietileno', 'polietilno')).toBe(1);
    expect(levenshteinDistance('', 'test')).toBe(4);
    expect(levenshteinDistance('mismo', 'mismo')).toBe(0);
  });

  it('calcula similitud alta para coincidencias parciales y errores tipográficos', () => {
    const sim1 = computeSimilarity('120267114114', '120267114114');
    expect(sim1).toBe(1.0);

    const sim2 = computeSimilarity('Providencia', 'Providensya');
    expect(sim2).toBeGreaterThan(0.7);

    const sim3 = computeSimilarity('TH-946', 'TH 946');
    expect(sim3).toBeGreaterThan(0.75);
  });

  it('ordena resultados por relevancia en una colección de órdenes', () => {
    const ordenes = [
      { id: '1', folio: '120267114114', client: 'GRUPO TEXTIL PROVIDENCIA (TH)' },
      { id: '2', folio: '12026439713', client: 'GRUPO TEXTIL PROVIDENCIA (GT)' },
      { id: '3', folio: 'CR-TH-946', client: 'TEXTIL HOGAR' },
    ];

    const results = fuzzySearch(ordenes, '14114', (o) => ({
      folio: o.folio,
      client: o.client,
    }));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.id).toBe('1');
    expect(results[0].score).toBeGreaterThanOrEqual(0.9);
  });
});
