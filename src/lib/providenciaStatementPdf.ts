import { money, kilos, fmtDate, fmtDateFull, fmtDateTimeFull, fmtDayAndDate, toDate } from './format';
import { extractCr, daysLate, round2 } from './finance';
import type { PurchaseOrder } from './types';

export interface ProvidenciaStatementInvoiceItem {
  id: string;
  orderId: string;
  orderFolio: string;
  invoiceFolio: string;
  contrarecibo: string;
  issueDate?: any;
  dueDate?: any;
  kilos: number;
  subtotal: number;
  iva: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  statusLabel: string;
  daysLate: number | null;
}

export interface ProvidenciaLedgerEntry {
  id: string;
  date: any;
  concept: string;
  cargo: number;
  abono: number;
  balance: number;
  transferRef?: string;
}

export interface ProvidenciaStatementData {
  clientName?: string;
  clientRfc?: string;
  companyName?: string;
  companyLogoUrl?: string;
  invoices: ProvidenciaStatementInvoiceItem[];
  ledger: ProvidenciaLedgerEntry[];
  totalInvoiced: number;
  totalPaid: number;
  activeBalance: number;
  currentBalance: number;
  overdueBalance: number;
  totalKilos: number;
}

export async function generateProvidenciaStatementPdf(data: ProvidenciaStatementData) {
  const html2pdf = (await import('html2pdf.js')).default;
  const fechaHoy = fmtDateFull(new Date());
  const fechaEmisionExacta = fmtDateTimeFull(new Date());

  const client = data.clientName || 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
  const rfc = data.clientRfc || 'GTP930115PU1';
  const company = data.companyName || 'Bolsas Elemental / Providencia';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 30px; color: #0f172a; background: #fff; max-width: 820px; margin: 0 auto; font-size: 11px; line-height: 1.4;">
      
      <!-- ENCABEZADO CORPORATIVO -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px;">${company.toUpperCase()}</div>
          <div style="font-size: 12px; color: #475569; font-weight: 800; margin-top: 2px;">ESTADO DE CUENTA, FACTURAS Y CONTRARECIBOS</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 3px;">
            Papalotla, Tlaxcala · Fecha de Emisión: <strong>${fechaHoy}</strong>
          </div>
        </div>

        <div style="text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; min-width: 220px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #2563eb; text-transform: uppercase;">DEUDA TOTAL ACTIVA</div>
          <div style="font-size: 19px; font-weight: 900; color: #0f172a; margin-top: 1px;">${money(data.activeBalance)}</div>
          <div style="font-size: 9px; color: #64748b;">Corte al: ${fechaEmisionExacta}</div>
        </div>
      </div>

      <!-- DATOS FISCALES DEL CLIENTE (RECEPTOR) -->
      <div style="background: #f1f5f9; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; border-left: 4px solid #2563eb; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">CLIENTE / RAZÓN SOCIAL:</div>
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-top: 1px;">${client}</div>
          <div style="font-size: 10px; color: #475569; margin-top: 2px;">
            <strong>RFC:</strong> ${rfc} · Régimen Fiscal: General de Ley Personas Morales
          </div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #475569;">
          <strong>Total Kilos Despachados:</strong> ${(data.totalKilos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg<br/>
          <strong>Facturas Activas:</strong> ${data.invoices.length} expedientes
        </div>
      </div>

      <!-- TARJETAS DE RESUMEN FINANCIERO -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">TOTAL FACTURADO</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px;">${money(data.totalInvoiced)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">TOTAL COBRADO / PAGADO</div>
          <div style="font-size: 15px; font-weight: 900; color: #16a34a; margin-top: 2px;">${money(data.totalPaid)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">SALDO VIGENTE (EN TIEMPO)</div>
          <div style="font-size: 15px; font-weight: 900; color: #2563eb; margin-top: 2px;">${money(data.currentBalance)}</div>
        </div>

        <div style="background: ${data.overdueBalance > 0 ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${data.overdueBalance > 0 ? '#fca5a5' : '#e2e8f0'}; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: ${data.overdueBalance > 0 ? '#991b1b' : '#64748b'}; text-transform: uppercase;">
            SALDO VENCIDO
          </div>
          <div style="font-size: 15px; font-weight: 900; color: ${data.overdueBalance > 0 ? '#b91c1c' : '#0f172a'}; margin-top: 2px;">
            ${money(data.overdueBalance)}
          </div>
        </div>
      </div>

      <!-- TABLA 1: FACTURAS Y CONTRARECIBOS DETALLADOS -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
          📑 1. Detalle de Facturas y Contrarecibos (Cartera de Clientes):
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 6px;">
          <thead>
            <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 8.5px;">
              <th style="padding: 5px 6px; text-align: left; border-radius: 4px 0 0 0;">Factura</th>
              <th style="padding: 5px 6px; text-align: left;">OC</th>
              <th style="padding: 5px 6px; text-align: left;">Contrarecibo</th>
              <th style="padding: 5px 6px; text-align: left;">Emisión</th>
              <th style="padding: 5px 6px; text-align: left;">Vencimiento</th>
              <th style="padding: 5px 6px; text-align: right;">Kilos</th>
              <th style="padding: 5px 6px; text-align: right;">Total Factura</th>
              <th style="padding: 5px 6px; text-align: right;">Cobrado</th>
              <th style="padding: 5px 6px; text-align: right;">Saldo Pendiente</th>
              <th style="padding: 5px 6px; text-align: center; border-radius: 0 4px 0 0;">Estatus</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.map((inv, idx) => {
              const isOverdue = inv.status === 'overdue' || (inv.daysLate !== null && inv.daysLate > 0 && inv.balance > 0);
              const isPaid = inv.balance <= 0 || inv.status === 'paid' || inv.status === 'collected';
              return `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 4px 6px; font-weight: 800; font-family: monospace; color: #0f172a;">${inv.invoiceFolio}</td>
                  <td style="padding: 4px 6px; font-family: monospace; color: #475569;">${inv.orderFolio}</td>
                  <td style="padding: 4px 6px; font-weight: 700; color: #2563eb;">${inv.contrarecibo || 'Sin CR'}</td>
                  <td style="padding: 4px 6px; color: #64748b;">${fmtDate(inv.issueDate)}</td>
                  <td style="padding: 4px 6px; color: #64748b;">${fmtDate(inv.dueDate)}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace;">${inv.kilos.toLocaleString('es-MX')} kg</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 600;">${money(inv.total)}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #16a34a;">${money(inv.paidAmount)}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 800; color: ${inv.balance > 0 ? (isOverdue ? '#b91c1c' : '#0f172a') : '#16a34a'};">
                    ${money(inv.balance)}
                  </td>
                  <td style="padding: 4px 6px; text-align: center;">
                    <span style="display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 8px; font-weight: 700; background: ${isPaid ? '#dcfce7' : isOverdue ? '#fee2e2' : '#dbeafe'}; color: ${isPaid ? '#166534' : isOverdue ? '#991b1b' : '#1e40af'};">
                      ${isPaid ? 'Cobrada' : isOverdue ? `Vencida (${inv.daysLate}d)` : 'Vigente'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${data.ledger && data.ledger.length > 0 ? `
        <!-- TABLA 2: HISTORIAL DE CARGOS Y ABONOS (LIBRO MAYOR) -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
            ⚖️ 2. Historial Cronológico de Movimientos y Depósitos Bancarios:
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background: #334155; color: #fff; text-transform: uppercase; font-size: 8.5px;">
                <th style="padding: 5px 6px; text-align: left; border-radius: 4px 0 0 0;">Fecha</th>
                <th style="padding: 5px 6px; text-align: left;">Concepto / Referencia</th>
                <th style="padding: 5px 6px; text-align: right;">Cargo (Facturación)</th>
                <th style="padding: 5px 6px; text-align: right;">Abono (Depósito Recibido)</th>
                <th style="padding: 5px 6px; text-align: right; border-radius: 0 4px 0 0;">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledger.slice(0, 15).map((l, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 4px 6px; color: #475569;">${fmtDayAndDate(l.date)}</td>
                  <td style="padding: 4px 6px; font-weight: 600; color: #0f172a;">${l.concept}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: ${l.cargo > 0 ? '#b91c1c' : '#94a3b8'};">
                    ${l.cargo > 0 ? money(l.cargo) : '-'}
                  </td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: ${l.abono > 0 ? '#16a34a' : '#94a3b8'};">
                    ${l.abono > 0 ? money(l.abono) : '-'}
                  </td>
                  <td style="padding: 4px 6px; text-align: right; font-weight: 800; font-family: monospace; color: #0f172a;">
                    ${money(l.balance)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${data.ledger.length > 15 ? `<div style="font-size: 8.5px; color: #64748b; text-align: right; margin-top: 4px;">* Mostrando los últimos 15 movimientos de ${data.ledger.length} registrados.</div>` : ''}
        </div>
      ` : ''}

      <!-- DATOS DE TRANSFERENCIA Y AVISO DE CONCILIACIÓN -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-top: 14px; display: grid; grid-template-columns: 2fr 1fr; gap: 16px; font-size: 9.5px;">
        <div>
          <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 2px;">INSTRUCCIONES DE CONCILIACIÓN Y PAGO:</div>
          <div style="color: #475569; line-height: 1.35;">
            Favor de reportar sus comprobantes de transferencia referenciando el folio de contrarecibo correspondiente.<br/>
            Para aclaraciones sobre saldos, contrarecibos y complementos de pago, comunicarse al área de cobranza.
          </div>
        </div>
        <div style="text-align: right; border-left: 1px solid #cbd5e1; padding-left: 14px;">
          <div style="font-size: 8.5px; color: #64748b;">Documento oficial auditado</div>
          <div style="font-size: 9px; font-weight: 800; color: #0f172a; margin-top: 2px;">CONTROL FINANCIERO PROVIDENCIA</div>
          <div style="font-size: 8.5px; color: #94a3b8; font-family: monospace; margin-top: 2px;">ID: STMT-${Date.now().toString(36).toUpperCase()}</div>
        </div>
      </div>

    </div>
  `;

  const filename = `Estado_Cuenta_Providencia_${new Date().toISOString().slice(0, 10)}.pdf`;
  const opt: any = {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(html).save();
}

export function buildProvidenciaStatementDataFromOrders(orders: PurchaseOrder[], config?: any): ProvidenciaStatementData {
  const invoicesList: ProvidenciaStatementInvoiceItem[] = [];
  const ledgerEntries: Omit<ProvidenciaLedgerEntry, 'balance'>[] = [];
  
  let totalInvoiced = 0;
  let totalPaid = 0;
  let currentBalance = 0;
  let overdueBalance = 0;
  let totalKilos = 0;

  (orders || []).forEach((o) => {
    if (!o || o.isClosedShort) return;

    (o.invoices || []).forEach((inv) => {
      if (!inv) return;
      const kg = Number(inv.kilos) || 0;
      totalKilos += kg;

      const subtotal = inv.financials?.saleTotal ?? round2(kg * (inv.financials?.salePricePerKg || config?.salePricePerKg || 43));
      const total = inv.financials?.invoiceTotal ?? round2(subtotal * 1.16);
      const iva = round2(total - subtotal);
      const paid = Number(inv.collection?.paidAmount) || 0;
      const balance = Math.max(0, round2(total - paid));

      const dIssue = toDate(inv.creditCycle?.issueDate);
      const dDue = toDate(inv.creditCycle?.dueDate);
      const late = daysLate(dDue);
      const cr = extractCr(inv, o);
      const st = inv.creditCycle?.status || 'pending';

      let statusLabel = 'En Tránsito';
      if (st === 'paid' || st === 'collected' || balance === 0) {
        statusLabel = 'Cobrada / Liquidada';
      } else if (st === 'overdue' || (late !== null && late > 0)) {
        statusLabel = 'Vencida';
      } else if (!cr) {
        statusLabel = 'En Revisión (Sin CR)';
      }

      totalInvoiced += total;
      totalPaid += paid;

      if (balance > 0) {
        if (st === 'overdue' || (late !== null && late > 0)) {
          overdueBalance += balance;
        } else {
          currentBalance += balance;
        }
      }

      invoicesList.push({
        id: inv.id,
        orderId: o.id,
        orderFolio: o.folio || o.oc || 'S/N',
        invoiceFolio: inv.folio || o.folio || 'S/N',
        contrarecibo: cr,
        issueDate: dIssue,
        dueDate: dDue,
        kilos: kg,
        subtotal,
        iva,
        total,
        paidAmount: paid,
        balance,
        status: st,
        statusLabel,
        daysLate: late,
      });

      // Cargo al libro mayor
      if (total > 0) {
        ledgerEntries.push({
          id: `cargo-${inv.id}`,
          date: dIssue || toDate(o.processedAt) || new Date(),
          concept: `Factura ${inv.folio || o.folio || 'S/N'} (${kilos(kg)})`,
          cargo: total,
          abono: 0,
        });
      }

      // Abono al libro mayor
      if (paid > 0) {
        ledgerEntries.push({
          id: `abono-${inv.id}`,
          date: toDate(inv.collection?.collectedAt) || toDate(inv.collection?.paidAt) || dIssue || new Date(),
          concept: `Cobro Factura ${inv.folio || o.folio || 'S/N'} (CR: ${cr || 'S/N'})`,
          cargo: 0,
          abono: paid,
          transferRef: inv.collection?.transferRef,
        });
      }
    });
  });

  // Ordenar libro mayor cronológicamente
  ledgerEntries.sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));

  let runningBalance = 0;
  const ledger: ProvidenciaLedgerEntry[] = ledgerEntries.map((e) => {
    runningBalance = round2(runningBalance + e.cargo - e.abono);
    return {
      ...e,
      balance: round2(runningBalance),
    };
  });

  return {
    clientName: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
    clientRfc: 'GTP9211049B6',
    companyName: config?.companyName || 'Bolsas Elemental / Providencia',
    companyLogoUrl: config?.companyLogoUrl,
    invoices: invoicesList,
    ledger: ledger.reverse(), // Más recientes primero
    totalInvoiced: round2(totalInvoiced),
    totalPaid: round2(totalPaid),
    activeBalance: round2(Math.max(0, totalInvoiced - totalPaid)),
    currentBalance: round2(currentBalance),
    overdueBalance: round2(overdueBalance),
    totalKilos: round2(totalKilos),
  };
}
