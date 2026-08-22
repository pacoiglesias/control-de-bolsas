import { daysLate } from '../../lib/finance';
import { toDate, shareHtmlAsPdf } from '../../lib/format';
import { getCobranzaGlobalHtml, getCarteraVencidaHtml, getConsolidatedCrHtml } from './reports';
import type { Tone } from '../../context/ToastContext';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): los 6 generadores
 * print* / share* (Reporte Global, Cartera Vencida, Contrarecibo Consolidado)
 * vivían como funciones sueltas en el componente. Se extraen aquí como un
 * hook que recibe `data`/`settings`/`toast` -- misma firma que ya consume
 * `ctx` (CobranzaContext), sin cambiar lógica.
 */
export function useCobranzaReports({
  data,
  settings,
  toast,
}: {
  data: any;
  settings: any;
  toast: (msg: string, tone?: Tone) => void;
}) {
  function printCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml(data, settings);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml(data, settings);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CobranzaGlobal_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function printCarteraVencida() {
    const overdueItems = data.open.filter((x: any) => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum: number, x: any) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(settings, overdueItems, totalVencido);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCarteraVencida() {
    const overdueItems = data.open.filter((x: any) => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum: number, x: any) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(settings, overdueItems, totalVencido);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CarteraVencida_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function printConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(settings, grp);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(settings, grp);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Contrarecibo_${grp.cr}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  return {
    printCobranzaGlobalReport,
    shareCobranzaGlobalReport,
    printCarteraVencida,
    shareCarteraVencida,
    printConsolidatedCr,
    shareConsolidatedCr,
  };
}
