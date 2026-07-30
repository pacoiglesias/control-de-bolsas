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

export const compactMoney = (n: number | undefined | null): string => {
  const num = Number(n) || 0;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 2 })}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k`;
  return money(num);
};

export const compactKilos = (n: number | undefined | null): string => {
  const num = Number(n) || 0;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}t`;
  return kilos(num);
};

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

/**
 * Escapa HTML antes de interpolar texto de negocio (folio, cliente, notas...)
 * dentro de las plantillas de impresión que se abren como Blob URL.
 *
 * Vivía duplicada dos veces dentro de OrderModal.tsx y no existía en absoluto
 * en Cobranza.tsx: su paquete consolidado interpolaba `client`, `cr` y los
 * folios sin escapar. Un blob URL abierto con `window.open` hereda el origen
 * de quien lo abre, así que cualquier HTML sin escapar ahí corre con la
 * sesión de Firebase viva — y esos datos vienen de PDFs leídos por Gemini,
 * no son de confianza. Única fuente de verdad para los tres constructores.
 */
export function escapeHtml(str: string | null | undefined): string {
  return (str ?? '').replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[tag] || tag),
  );
}
