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

/**
 * "MIGRACION" es un marcador interno para expedientes historicos donde
 * nunca se capturo el nombre real del cliente al migrar los datos --
 * no es un cliente de verdad. Mostrarlo tal cual en pantalla ("Cliente:
 * MIGRACION") confunde mas que ayuda. Esta funcion traduce SOLO lo que
 * el usuario ve; el dato guardado en Firestore sigue siendo "MIGRACION"
 * (varias comparaciones logicas del sistema dependen de ese valor
 * exacto para excluir estos expedientes de ciertos calculos).
 */
export function nombreClienteVisible(client: string | null | undefined): string {
  if (client === 'MIGRACION') return 'Histórico (sin cliente registrado)';
  return client || '—';
}

/**
 * Responsables de Área Providencia:
 * - Textil Hogar (TH): Nava
 * - Grupo Textil (GT): Evelia
 */
export const DEPARTMENT_MANAGERS: Record<string, { name: string; fullDept: string; title: string }> = {
  TH: {
    name: 'Nava',
    fullDept: 'Textil Hogar',
    title: 'Nava · Textil Hogar',
  },
  GT: {
    name: 'Evelia',
    fullDept: 'Grupo Textil',
    title: 'Evelia · Grupo Textil',
  },
};

export function getDepartmentManager(deptOrClient?: string | null): string {
  if (!deptOrClient) return '';
  const upper = deptOrClient.toUpperCase();
  if (upper.includes('TH') || upper.includes('TEXTIL HOGAR')) return 'Nava';
  if (upper.includes('GT') || upper.includes('GRUPO TEXTIL')) return 'Evelia';
  return '';
}

export function getDepartmentBadgeLabel(deptOrClient?: string | null): string {
  if (!deptOrClient) return '';
  const upper = deptOrClient.toUpperCase();
  if (upper.includes('TH') || upper.includes('TEXTIL HOGAR')) return 'TH (Nava)';
  if (upper.includes('GT') || upper.includes('GRUPO TEXTIL')) return 'GT (Evelia)';
  return deptOrClient;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Firestore devuelve Timestamp; los formularios y calculos usan Date. */
export function toDate(ts: Timestamp | Date | null | undefined | any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
  if (typeof ts === 'object' && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function fmtDate(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

export function fmtDayAndDate(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  const diaSem = DIAS_SEMANA[d.getDay()];
  return `${diaSem}, ${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

export function fmtDateFull(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  const DIAS_COMPLETOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES_COMPLETOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${DIAS_COMPLETOS[d.getDay()]} ${d.getDate()} de ${MESES_COMPLETOS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function fmtDateTime(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtDateTimeFull(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '—';
  const fecha = fmtDateFull(d);
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fecha} · ${hora}`;
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
 * sesión de Firebase viva. Única fuente de verdad para los tres constructores.
 */
export function escapeHtml(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getPrintHeaderHtml(settings: any, title: string, subtitle?: string) {
  const logoUrl = settings?.companyLogoUrl || '/logo.png';
  const logoHtml = `<img src="${logoUrl}" alt="Logo" style="width: 100px; height: 100px; object-fit: contain;" />`;

  return `
    <div style="display: flex; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 24px;">
      ${logoHtml}
      <div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${settings?.companyName || 'Bolsas Elemental'}</div>
        <div style="font-size: 14px; font-weight: 600; color: #475569;">${title}</div>
        ${subtitle ? `<div style="font-size: 13px; color: #64748b; margin-top: 4px;">${subtitle}</div>` : ''}
      </div>
      <div style="margin-left: auto; text-align: right; font-size: 12px; color: #64748b;">
        Fecha de Emisión: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
        Generado desde Bolsas Elemental ERP
      </div>
    </div>
  `;
}

export async function shareHtmlAsPdf(htmlString: string, filename: string = 'documento.pdf') {
  const container = document.createElement('div');
  
  // Extract body content and styles
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  const styles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\\n');
  const bodyHtml = doc.body.innerHTML;
  
  container.innerHTML = styles + bodyHtml;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '800px'; 
  container.style.padding = '20px';
  container.style.background = '#fff';
  
  document.body.appendChild(container);

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const opt: any = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
    };

    const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: filename,
        text: 'Te comparto este documento PDF generado desde Bolsas Elemental.',
        files: [file],
      });
    } else {
      // Fallback
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error sharing PDF:', error);
    // Fallback: print
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(htmlString);
      w.document.close();
      w.focus();
    }
  } finally {
    document.body.removeChild(container);
  }
}
