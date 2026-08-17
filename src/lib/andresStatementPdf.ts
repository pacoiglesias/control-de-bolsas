import { money, fmtDateFull, fmtDateTimeFull, fmtDayAndDate } from './format';

interface LedgerItem {
  id: string;
  date: any;
  concept: string;
  cargo: number;
  abono: number;
  source: 'purchase' | 'expense' | 'historical';
  balance: number;
}

export interface AndresStatementDeliveryItem {
  folio: string;
  client?: string;
  orderedKg: number;
  receivedKg: number;
  costPerKg: number;
  totalCost: number;
  status: string;
  deliveryDate?: any;
}

export async function generateAndresAuditStatementPdf(data: {
  totalReceivedKilos: number;
  totalPurchasesCost: number;
  totalPagado: number;
  saldoProveedor: number;
  deudaHistorica: number;
  currentCostPerKg: number;
  ledger: LedgerItem[];
  deliveriesList?: AndresStatementDeliveryItem[];
}) {
  const html2pdf = (await import('html2pdf.js')).default;
  const fechaHoy = fmtDateFull(new Date());
  const fechaEmisionExacta = fmtDateTimeFull(new Date());

  const esAnticipo = data.saldoProveedor > 0;
  const saldoAbs = Math.abs(data.saldoProveedor);
  const deliveries = data.deliveriesList || [];

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 30px; color: #0f172a; background: #fff; max-width: 820px; margin: 0 auto; font-size: 11.5px; line-height: 1.4;">
      
      <!-- ENCABEZADO FORMAL -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c3aed; padding-bottom: 14px; margin-bottom: 18px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #5b21b6; letter-spacing: -0.5px;">ESTADO DE CUENTA, ENTREGAS Y LIQUIDACIÓN</div>
          <div style="font-size: 12px; color: #475569; font-weight: 700; margin-top: 2px;">PROVEEDOR: ANDRÉS (TALLER MAQUILADOR DE POLIETILENO)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Distribuidora Providencia · Papalotla, Tlaxcala · Fecha: <strong>${fechaHoy}</strong>
          </div>
        </div>

        <div style="text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; min-width: 210px;">
          <div style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">PRECIO POR KILO PACTADO</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px;">$${data.currentCostPerKg.toFixed(2)} / kg</div>
          <div style="font-size: 9.5px; color: #64748b;">Emisión: ${fechaEmisionExacta}</div>
        </div>
      </div>

      <!-- TARJETAS DE RESUMEN EJECUTIVO -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">KILOS ENTREGADOS</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${data.totalReceivedKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</div>
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

      ${deliveries.length > 0 ? `
        <!-- TABLA 1: FLUJO DE ENTREGAS Y PEDIDOS SURTIDOS -->
        <div style="margin-bottom: 22px;">
          <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            📦 1. Detalle de Pedidos y Entregas Surtidas en Báscula:
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
            <thead>
              <tr style="background: #334155; color: #fff; text-transform: uppercase; font-size: 9px;">
                <th style="padding: 6px 8px; text-align: left; border-radius: 4px 0 0 0;">OC / Folio</th>
                <th style="padding: 6px 8px; text-align: left;">Cliente</th>
                <th style="padding: 6px 8px; text-align: right;">Pedido (Kg)</th>
                <th style="padding: 6px 8px; text-align: right;">Entregado en Báscula (Kg)</th>
                <th style="padding: 6px 8px; text-align: center;">% Surtido</th>
                <th style="padding: 6px 8px; text-align: right;">Costo Maquila</th>
                <th style="padding: 6px 8px; text-align: center; border-radius: 0 4px 0 0;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${deliveries.map((d, idx) => {
                const pct = d.orderedKg > 0 ? Math.min(100, Math.round((d.receivedKg / d.orderedKg) * 100)) : 100;
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 5px 8px; font-weight: 800; font-family: monospace; color: #0f172a;">${d.folio}</td>
                    <td style="padding: 5px 8px; color: #475569;">${d.client || 'Providencia'}</td>
                    <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${d.orderedKg.toLocaleString('es-MX')} kg</td>
                    <td style="padding: 5px 8px; text-align: right; font-weight: 700; font-family: monospace; color: #047857;">${d.receivedKg.toLocaleString('es-MX')} kg</td>
                    <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: ${pct >= 100 ? '#16a34a' : '#d97706'};">${pct}%</td>
                    <td style="padding: 5px 8px; text-align: right; font-weight: 800; font-family: monospace;">${money(d.totalCost)}</td>
                    <td style="padding: 5px 8px; text-align: center;">
                      <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; background: ${pct >= 100 ? '#dcfce7' : '#fef3c7'}; color: ${pct >= 100 ? '#166534' : '#b45309'};">
                        ${pct >= 100 ? 'Completado' : 'En Surtido'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- TABLA 2: LIBRO MAYOR CRONOLÓGICO DE MOVIMIENTOS Y PAGOS -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
          ⚖️ 2. Historial Cronológico de Movimientos y Abonos de Pago:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 9px;">
              <th style="padding: 6px 8px; text-align: left; border-radius: 4px 0 0 0;">Fecha</th>
              <th style="padding: 6px 8px; text-align: left;">Concepto / Detalle</th>
              <th style="padding: 6px 8px; text-align: right;">Cargo (Material Entregado)</th>
              <th style="padding: 6px 8px; text-align: right;">Abono (Pago Entregado)</th>
              <th style="padding: 6px 8px; text-align: right; border-radius: 0 4px 0 0;">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            ${data.ledger.map((it, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 5px 8px; color: #475569; font-weight: 600;">${fmtDayAndDate(it.date)}</td>
                <td style="padding: 5px 8px; font-weight: 600; color: #0f172a;">${it.concept}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: ${it.cargo > 0 ? '#b91c1c' : '#94a3b8'};">
                  ${it.cargo > 0 ? money(it.cargo) : '-'}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: ${it.abono > 0 ? '#15803d' : '#94a3b8'};">
                  ${it.abono > 0 ? money(it.abono) : '-'}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-weight: 800; font-family: monospace; color: ${it.balance < 0 ? '#b91c1c' : '#15803d'};">
                  ${money(it.balance)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- RECUADRO DE FIRMAS Y CONFORMIDAD -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 10px;">
        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">ANDRÉS (TALLER MAQUILADOR)</div>
          <div style="font-size: 10px; color: #64748b;">Firma de conformidad de entregas surtidas y pagos</div>
        </div>

        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">ADMINISTRACIÓN / SOCIOS PROVIDENCIA</div>
          <div style="font-size: 10px; color: #64748b;">Firma autorizada de liquidación</div>
        </div>
      </div>

    </div>
  `;

  const opt: any = {
    margin: [8, 8, 8, 8],
    filename: `Estado_Cuenta_Andres_Entregas_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(html).save();
}
