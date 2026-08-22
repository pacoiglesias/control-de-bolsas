/**
 * math.test.ts -- Pruebas unitarias para src/lib/math.ts
 * Cubre: operaciones fixed-point, redondeo bancario, casos borde.
 * Audit v2.0 -- 2026-08-02
 */
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, roundBankers } from '../math';

describe('math.ts -- operaciones fixed-point', () => {

  describe('add()', () => {
    it('suma correctamente sin error de punto flotante', () => {
      expect(add(0.1, 0.2)).toBe(0.3);
    });
    it('suma montos grandes de pesos MXN', () => {
      expect(add(47000.25, 3500.75)).toBe(50501);
    });
    it('suma con cero', () => {
      expect(add(5000, 0)).toBe(5000);
    });
    it('suma negativos', () => {
      expect(add(-100, 50)).toBe(-50);
    });
  });

  describe('subtract()', () => {
    it('resta correctamente sin error de punto flotante', () => {
      expect(subtract(1.5, 0.3)).toBe(1.2);
    });
    it('resta que resulta en cero', () => {
      expect(subtract(100.50, 100.50)).toBe(0);
    });
    it('resta con resultado negativo', () => {
      expect(subtract(100, 150)).toBe(-50);
    });
  });

  describe('multiply()', () => {
    it('1000 kg x 47 MXN/kg = 47000', () => {
      expect(multiply(1000, 47)).toBe(47000);
    });
    it('47000 x 1.16 IVA = 54520', () => {
      expect(multiply(47000, 1.16)).toBe(54520);
    });
    it('multiplica por cero', () => {
      expect(multiply(99999, 0)).toBe(0);
    });
    it('0.08 x 4700 comision = 376', () => {
      expect(multiply(0.08, 4700)).toBe(376);
    });
  });

  describe('divide()', () => {
    it('divide correctamente', () => {
      expect(divide(100, 4)).toBe(25);
    });
    it('47000 / 1000 kg = 47 por kg', () => {
      expect(divide(47000, 1000)).toBe(47);
    });
    it('CRITICO: divide por cero retorna 0 sin NaN ni Infinity', () => {
      expect(divide(100, 0)).toBe(0);
      expect(divide(0, 0)).toBe(0);
      expect(Number.isFinite(divide(1, 0))).toBe(true);
      expect(Number.isNaN(divide(1, 0))).toBe(false);
    });
    it('divide montos de centavos', () => {
      expect(divide(0.01, 2)).toBe(0.005);
    });
  });

  describe('roundBankers()', () => {
    it('2.5 redondea a 2 (al par)', () => {
      expect(roundBankers(2.5, 0)).toBe(2);
    });
    it('3.5 redondea a 4 (al par)', () => {
      expect(roundBankers(3.5, 0)).toBe(4);
    });
    it('2.4 redondea a 2, 2.6 redondea a 3', () => {
      expect(roundBankers(2.4, 0)).toBe(2);
      expect(roundBankers(2.6, 0)).toBe(3);
    });
    it('maneja cero', () => {
      expect(roundBankers(0, 2)).toBe(0);
    });
  });

});