import { fmtDate, money, getPrintHeaderHtml } from '../../lib/format';
import type { Expense } from '../../lib/types';

export function getCajaChicaHtml(expenses: Expense[], settings: any, saldo: number) {
  const totalIngresos = expenses.filter((e) => e.type === 'ingreso').reduce((a, e) => a + e.amount, 0);
  const totalEgresos = expenses.filter((e) => e.type === 'egreso').reduce((a, e) => a + e.amount, 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Caja y Tesorería - Providencia</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background-color: #fafaf9; }
          .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
          .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
          .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
          .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
          .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        </style>
      </head>
      <body>
        ${getPrintHeaderHtml(settings, "Corte de Caja (Ingresos y Egresos)")}

        <div class="kpis">
          <div class="kpi"><div class="kpi-title">TOTAL INGRESOS</div><div class="kpi-val" style="color: #047857;">+${money(totalIngresos)}</div></div>
          <div class="kpi"><div class="kpi-title">TOTAL EGRESOS</div><div class="kpi-val" style="color: #b91c1c;">-${money(totalEgresos)}</div></div>
          <div class="kpi"><div class="kpi-title">SALDO LÍQUIDO EN CAJA</div><div class="kpi-val" style="color: #2563eb;">${money(saldo)}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Tipo</th><th class="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${expenses
              .map(
                (e) => `
              <tr>
                <td>${fmtDate(e.date) || '—'}</td>
                <td>${e.concept || '—'}</td>
                <td>${e.provider || '—'}</td>
                <td>${e.type === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
                <td class="num" style="font-weight:700; color: ${e.type === 'ingreso' ? '#047857' : '#b91c1c'}">
                  ${e.type === 'ingreso' ? '+' : '-'}${money(e.amount)}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <script>
          window.onafterprint = () => window.close();
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `;
}
