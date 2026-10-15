import { expect, it } from 'vitest';
import { resolveInvoiceDates } from '../invoiceDates';
import { toInputDate } from '../format';
it('conserva la fecha histórica del CFDI y calcula crédito cruzando mes', () => {
  const result = resolveInvoiceDates('2026-09-24', '', 30);
  expect(toInputDate(result.issue)).toBe('2026-09-24'); expect(toInputDate(result.due)).toBe('2026-10-24');
});
it('respeta vencimientos capturados y crédito de cero días', () => {
  expect(toInputDate(resolveInvoiceDates('2026-10-15', '2026-11-02', 30).due)).toBe('2026-11-02');
  expect(toInputDate(resolveInvoiceDates('2026-10-15', '', 0).due)).toBe('2026-10-15');
});
it('rechaza fechas inexistentes, vacías y vencimiento anterior', () => {
  expect(() => resolveInvoiceDates('2026-02-30', '', 30)).toThrow();
  expect(() => resolveInvoiceDates('', '', 30)).toThrow();
  expect(() => resolveInvoiceDates('2026-10-15', '2026-10-14', 30)).toThrow();
});
