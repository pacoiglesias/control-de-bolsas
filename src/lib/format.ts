import type { Timestamp } from 'firebase/firestore';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const money = (n: number | undefined | null): string =>
  (Number(n) || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const kilos = (n: number | undefined | null): string =>
  `${(Number(n) || 0).toLocaleString('es-MX')} kg`;

export const percent = (n: number | undefined | null): string =>
  `${((Number(n) || 0) * 100).toLocaleString('es-MX', { maximumFractionDigits: 3 })}%`;

/** Firestore devuelve Timestamp; los formularios y calculos usan Date. */
export function toDate(ts: Timestamp | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate();
  return null;
}

export function fmtDate(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

export function fmtDateTime(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

/** yyyy-mm-dd para <input type="date"> en hora local, no UTC. */
export function toInputDate(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
}
