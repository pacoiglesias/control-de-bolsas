import { money, kilos, fmtDateFull, fmtDateTimeFull, fmtDayAndDate } from './format';

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
          <div style="font-size: 12px; color: #475569; font-weight: 700; margin-top: 2px;">PROVEEDOR: ANDRÉS (FABRICANTE / PROVEEDOR DE POLIETILENO)</div>
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

      <!-- RESUMEN EJECUTIVO (CARDS) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">📦 Kilos Recibidos</div>
          <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px;">${kilos(data.totalReceivedKilos)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">💼 Costo Total ($42/kg)</div>
          <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px;">${money(data.totalPurchasesCost)}</div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9px; font-weight: 800; color: #166534; text-transform: uppercase;">💵 Pagos Realizados</div>
          <div style="font-size: 14px; font-weight: 900; color: #15803d; margin-top: 2px;">${money(data.totalPagado)}</div>
        </div>

        <div style="background: ${esAnticipo ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${esAnticipo ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 10px 12px;">
          <div style="font-size: 9px; font-weight: 800; color: ${esAnticipo ? '#166534' : '#991b1b'}; text-transform: uppercase;">
            ${esAnticipo ? '🟢 Anticipo a Favor' : '🔴 Saldo Pendiente'}
          </div>
          <div style="font-size: 15px; font-weight: 900; color: ${esAnticipo ? '#15803d' : '#dc2626'}; margin-top: 2px;">
            ${money(saldoAbs)}
          </div>
        </div>
      </div>

      <!-- TABLA 1: ENTREGAS POR ORDEN DE COMPRA (SI EXISTEN) -->
      ${deliveries.length > 0 ? `
        <div style="margin-bottom: 22px;">
          <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            📋 1. Desglose de Entregas por Pedido / OC:
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 9px; color: #475569; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 6px 8px; text-align: left;">Pedido / OC</th>
                <th style="padding: 6px 8px; text-align: left;">Cliente</th>
                <th style="padding: 6px 8px; text-align: right;">Pedido (Kg)</th>
                <th style="padding: 6px 8px; text-align: right;">Entregado (Kg)</th>
                <th style="padding: 6px 8px; text-align: right;">Costo/Kg</th>
                <th style="padding: 6px 8px; text-align: right;">Importe Total</th>
                <th style="padding: 6px 8px; text-align: center;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${deliveries.map((del, idx) => {
                const pct = del.orderedKg > 0 ? Math.round((del.receivedKg / del.orderedKg) * 100) : 100;
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">${del.folio}</td>
                    <td style="padding: 5px 8px; color: #475569;">${del.client || 'Providencia'}</td>
                    <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${kilos(del.orderedKg)}</td>
                    <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #047857;">${kilos(del.receivedKg)}</td>
                    <td style="padding: 5px 8px; text-align: right; font-family: monospace;">$${del.costPerKg.toFixed(2)}</td>
                    <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700;">${money(del.totalCost)}</td>
                    <td style="padding: 5px 8px; text-align: center;">
                      <span style="font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${pct >= 100 ? '#dcfce7' : '#fef3c7'}; color: ${pct >= 100 ? '#15803d' : '#b45309'};">
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

      <!-- TABLA 2: LIBRO MAYOR (ENTREGAS EN BÁSCULA VS PAGOS EFECTUADOS) -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
          ⚖️ 2. Conciliación Contable y Movimientos (Libro Mayor):
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 9px; color: #475569; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 6px 8px; text-align: left;">Fecha</th>
              <th style="padding: 6px 8px; text-align: left;">Concepto / Detalle</th>
              <th style="padding: 6px 8px; text-align: right;">Entrega (Kg)</th>
              <th style="padding: 6px 8px; text-align: right;">Valor Entrega (Cargo)</th>
              <th style="padding: 6px 8px; text-align: right;">Pago Realizado (Abono)</th>
              <th style="padding: 6px 8px; text-align: right;">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            ${data.ledger.map((entry: any, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 5px 8px; color: #64748b;">${fmtDayAndDate(entry.date)}</td>
                <td style="padding: 5px 8px; font-weight: 600; color: #1e293b;">${entry.concept}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #047857;">
                  ${entry.kilos ? `${kilos(entry.kilos)}` : '—'}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${entry.cargo > 0 ? '#dc2626' : '#94a3b8'};">
                  ${entry.cargo > 0 ? money(entry.cargo) : '—'}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${entry.abono > 0 ? '#16a34a' : '#94a3b8'};">
                  ${entry.abono > 0 ? money(entry.abono) : '—'}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">
                  ${money(entry.balance)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- RECUADRO DE FIRMAS Y CONFORMIDAD -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 10px;">
        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">ANDRÉS (PROVEEDOR / FABRICANTE)</div>
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
