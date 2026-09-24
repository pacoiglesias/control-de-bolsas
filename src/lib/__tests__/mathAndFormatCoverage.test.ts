import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, roundBankers, money as mathMoney, kilos as mathKilos } from '../math';
import {
  money,
  kilos,
  compactMoney,
  compactKilos,
  percent,
  nombreClienteVisible,
  getDepartmentManager,
  getDepartmentBadgeLabel,
  toDate,
  fmtDate,
  fmtDayAndDate,
  fmtDateFull,
  fmtDateTime,
  fmtDateTimeFull,
  toInputDate,
  fromInputDate,
  monthKey,
  monthLabel,
  escapeHtml,
} from '../format';

describe('math.ts enterprise utilities', () => {
  it('add, subtract, multiply, divide con precisión interna', () => {
    expect(add(0.1, 0.2)).toBe(0.3);
    expect(subtract(1.5, 0.3)).toBe(1.2);
    expect(multiply(10, 4.3)).toBe(43);
    expect(divide(100, 2)).toBe(50);
    expect(divide(100, 0)).toBe(0);
  });

  it('roundBankers redondeo bancario', () => {
    expect(roundBankers(2.5, 0)).toBe(2); // par
    expect(roundBankers(3.5, 0)).toBe(4); // redondea a par
    expect(roundBankers(2.55, 1)).toBe(2.6);
  });

  it('money y kilos en math.ts', () => {
    expect(mathMoney(1250.5)).toContain('1,250.50');
    expect(mathMoney(NaN as any)).toBe('$0.00');
    expect(mathMoney(null as any)).toBe('$0.00');
    expect(mathKilos(1500)).toBe('1,500.00 kg');
    expect(mathKilos(null as any)).toBe('0.00 kg');
  });
});

describe('format.ts utilities', () => {
  it('money, kilos, compactMoney, compactKilos, percent', () => {
    expect(money(1000)).toContain('1,000.00');
    expect(money(null)).toContain('0.00');

    expect(kilos(500.5)).toBe('500.5 kg');
    expect(kilos(null)).toBe('0 kg');

    expect(compactMoney(1500000)).toBe('$1.5M');
    expect(compactMoney(2500)).toBe('$2.5k');
    expect(compactMoney(500)).toContain('500.00');
    expect(compactMoney(NaN)).toBe('$0.00');

    expect(compactKilos(2500)).toBe('2.5t');
    expect(compactKilos(500)).toBe('500 kg');
    expect(compactKilos(NaN)).toBe('0 kg');

    expect(percent(0.16)).toBe('16%');
    expect(percent(null)).toBe('0%');
  });

  it('nombreClienteVisible limpia etiquetas de migracion o proveedor', () => {
    expect(nombreClienteVisible('MIGRACION')).toBe('Histórico (sin cliente registrado)');
    expect(nombreClienteVisible(null)).toBe('—');
    expect(nombreClienteVisible('GRUPO TEXTIL PROVIDENCIA - N0321 ELEMENTAL DENIM')).toBe('GRUPO TEXTIL PROVIDENCIA');
    expect(nombreClienteVisible('CLIENTE NORMAL')).toBe('CLIENTE NORMAL');
  });

  it('getDepartmentManager y getDepartmentBadgeLabel', () => {
    expect(getDepartmentManager('TH-ALMACEN')).toBe('Nava');
    expect(getDepartmentManager('GT-ALMACEN')).toBe('Evelia');
    expect(getDepartmentManager('OTRO')).toBe('');
    expect(getDepartmentManager(null)).toBe('');

    expect(getDepartmentBadgeLabel('TH')).toBe('TH (Nava)');
    expect(getDepartmentBadgeLabel('GT')).toBe('GT (Evelia)');
    expect(getDepartmentBadgeLabel('OTRO')).toBe('OTRO');
    expect(getDepartmentBadgeLabel(null)).toBe('');
  });

  it('toDate y formateadores de fecha', () => {
    const d = new Date(2026, 8, 24, 10, 30); // 24 de Sep de 2026
    expect(toDate(d)).toEqual(d);
    expect(toDate(d.getTime())).toEqual(d);
    expect(toDate('2026-09-24T10:30:00Z')).toBeInstanceOf(Date);
    expect(toDate(null)).toBeNull();
    expect(toDate('fecha-invalida')).toBeNull();

    expect(fmtDate(d)).toBe('24/Sep/2026');
    expect(fmtDate(null)).toBe('—');

    expect(fmtDayAndDate(d)).toContain('24/Sep/2026');
    expect(fmtDayAndDate(null)).toBe('—');

    expect(fmtDateFull(d)).toContain('24 de Septiembre, 2026');
    expect(fmtDateFull(null)).toBe('—');

    expect(fmtDateTime(d)).toBeTruthy();
    expect(fmtDateTime(null)).toBe('—');

    expect(fmtDateTimeFull(d)).toContain('24 de Septiembre, 2026');
    expect(fmtDateTimeFull(null)).toBe('—');

    const inputDate = toInputDate(d);
    expect(inputDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toInputDate(null)).toBe('');

    const parsed = fromInputDate('2026-09-24');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(24);
    expect(fromInputDate('')).toBeNull();
    expect(fromInputDate('invalido')).toBeNull();

    expect(monthKey(d)).toBe('2026-09');
    expect(monthLabel('2026-09')).toBe('Sep 26');
  });

  it('escapeHtml previene inyección en vistas o blobs', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("Tom's & Jerry's")).toBe('Tom&#039;s &amp; Jerry&#039;s');
    expect(escapeHtml(null)).toBe('');
  });
});
