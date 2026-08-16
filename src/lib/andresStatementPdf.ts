import { money, fmtDate } from './format';

interface LedgerItem {
  id: string;
  date: any;
  concept: string;
  cargo: number;
  abono: number;
  source: 'purchase' | 'expense';
  balance: number;
}

export async function generateAndresAuditStatementPdf(data: {
  totalReceivedKilos: number;
  totalPurchasesCost: number;
  totalPagado: number;
  saldoProveedor: number;
  deudaHistorica: number;
  currentCostPerKg: number;
  ledger: LedgerItem[];
}) {
  const html2pdf = (await import('html2pdf.js')).default;
  const fechaHoy = fmtDate(new Date());

  const esAnticipo = data.saldoProveedor > 0;
  const saldoAbs = Math.abs(data.saldoProveedor);

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 30px; color: #0f172a; background: #fff; max-width: 800px; margin: 0 auto; font-size: 11.5px; line-height: 1.4;">
      
      <!-- ENCABEZADO FORMAL -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c3aed; padding-bottom: 14px; margin-bottom: 18px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #5b21b6; letter-spacing: -0.5px;">ESTADO DE CUENTA Y LIQUIDACIÓN DE MAQUILA</div>
          <div style="font-size: 12px; color: #475569; font-weight: 700; margin-top: 2px;">PROVEEDOR: ANDRÉS (TALLER MAQUILA DE BOLSA)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Distribuidora Providencia · Papalotla, Tlaxcala · Fecha de Emisión: <strong>${fechaHoy}</strong>
          </div>
        </div>

        <div style="text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; min-width: 200px;">
          <div style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">PRECIO POR KILO PACTADO</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px;">$${data.currentCostPerKg.toFixed(2)} / kg</div>
          <div style="font-size: 10px; color: #64748b;">Kilos entregados a Providencia</div>
        </div>
      </div>

      <!-- TARJETAS DE RESUMEN EJECUTIVO -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">KILOS ENTREGADOS</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${data.totalReceivedKilos.toLocaleString('es-MX')} kg</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">TOTAL FABRICADO ($)</div>
          <div style="font-size: 16px; font-weight: 900; color: #5b21b6; margin-top: 2px;">${money(data.totalPurchasesCost)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">TOTAL PAGADO ($)</div>
          <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 2px;">${money(data.totalPagado)}</div>
        </div>

        <div style="background: ${esAnticipo ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${esAnticipo ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9.5px; font-weight: 800; color: ${esAnticipo ? '#166534' : '#991b1b'}; text-transform: uppercase;">
            ${esAnticipo ? 'ANTICIPO A FAVOR' : 'SALDO POR PAGAR'}
          </div>
          <div style="font-size: 16px; font-weight: 900; color: ${esAnticipo ? '#15803d' : '#b91c1c'}; margin-top: 2px;">
            ${esAnticipo ? '+' : '-'}${money(saldoAbs)}
          </div>
        </div>
      </div>

      <!-- TABLA DETALLADA DE MOVIMIENTOS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10.5px;">
        <thead>
          <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 9.5px;">
            <th style="padding: 7px 10px; text-align: left; border-radius: 4px 0 0 0;">Fecha</th>
            <th style="padding: 7px 10px; text-align: left;">Concepto / Detalle</th>
            <th style="padding: 7px 10px; text-align: right;">Cargo (Material)</th>
            <th style="padding: 7px 10px; text-align: right;">Abono (Pago)</th>
            <th style="padding: 7px 10px; text-align: right; border-radius: 0 4px 0 0;">Saldo Restante</th>
          </tr>
        </thead>
        <tbody>
          ${data.ledger.map((it, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 6px 10px; color: #475569;">${fmtDate(it.date)}</td>
              <td style="padding: 6px 10px; font-weight: 600; color: #0f172a;">${it.concept}</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: ${it.cargo > 0 ? '#b91c1c' : '#94a3b8'};">
                ${it.cargo > 0 ? money(it.cargo) : '-'}
              </td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: ${it.abono > 0 ? '#15803d' : '#94a3b8'};">
                ${it.abono > 0 ? money(it.abono) : '-'}
              </td>
              <td style="padding: 6px 10px; text-align: right; font-weight: 800; font-family: monospace; color: ${it.balance < 0 ? '#b91c1c' : '#15803d'};">
                ${money(it.balance)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- RECUADRO DE FIRMAS Y CONFORMIDAD -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 10px;">
        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">ANDRÉS (TALLER MAQUILADOR)</div>
          <div style="font-size: 10px; color: #64748b;">Firma de conformidad de entregas y pagos</div>
        </div>

        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">PACO IGLESIAS / DISTRIBUIDORA</div>
          <div style="font-size: 10px; color: #64748b;">Firma autorizada de liquidación</div>
        </div>
      </div>

    </div>
  `;

  const opt: any = {
    margin: [8, 8, 8, 8],
    filename: `Estado_Cuenta_Andres_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(html).save();
}
