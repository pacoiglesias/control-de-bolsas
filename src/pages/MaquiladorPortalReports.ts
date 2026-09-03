import { money } from '../lib/format';

// Extraido de MaquiladorPortal.tsx: generadores puros de HTML para los PDFs
// del portal de proveedor (Estado de Cuenta y Remision/Comprobante de
// Entrega). No tienen efectos secundarios -- solo arman un string de HTML a
// partir de lo que reciben por parametro -- asi que separarlos es de bajo
// riesgo. MaquiladorPortal.tsx conserva las funciones handleDownloadPdf /
// handleDownloadDeliveryTicket (que si tocan toast/html2pdf) y solo llaman a
// estas para obtener el HTML.

export function getStatementHtml(statement: any, provName: string, clientName: string) {
  return `
        <div style="font-family: 'Inter', system-ui, sans-serif; padding: 36px; color: #0f172a; max-width: 800px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 24px; color: #6d28d9; font-weight: 800;">ESTADO DE CUENTA · PROVEEDOR</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Proveedor: ${provName} · Suministro a ${clientName}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">Fecha de Emisión:</p>
              <p style="margin: 2px 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid #8b5cf6;">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Adquirido</div>
              <div style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin-top: 4px;">${money(statement.totalPurchasesCost)}</div>
            </div>
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid #10b981;">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Pagado</div>
              <div style="font-size: 20px; font-weight: 800; color: #047857; margin-top: 4px;">${money(statement.totalPagado)}</div>
            </div>
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid ${statement.saldoProveedor >= 0 ? '#10b981' : '#f59e0b'};">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">${statement.saldoProveedor >= 0 ? 'Saldo a tu Favor (Anticipos)' : 'Saldo por Cobrar'}</div>
              <div style="font-size: 20px; font-weight: 800; color: ${statement.saldoProveedor >= 0 ? '#047857' : '#b45309'}; margin-top: 4px;">
                ${statement.saldoProveedor >= 0 ? '+' : '-'}${money(Math.abs(statement.saldoProveedor))}
              </div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Desglose de Movimientos</h3>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">Fecha</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">Concepto</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Entrega (Cargo)</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Pago (Abono)</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${statement.ledger.map((r: any) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; color: #64748b;">${new Date(r.dateMillis).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td style="padding: 8px 10px; font-weight: 600;">${r.concept}</td>
                  <td style="padding: 8px 10px; text-align: right; color: ${r.cargo > 0 ? '#dc2626' : '#94a3b8'}; font-family: monospace;">${r.cargo > 0 ? money(r.cargo) : '-'}</td>
                  <td style="padding: 8px 10px; text-align: right; color: ${r.abono > 0 ? '#059669' : '#94a3b8'}; font-family: monospace;">${r.abono > 0 ? money(r.abono) : '-'}</td>
                  <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700;">${money(r.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
            <div>Generado automáticamente por Control Bolsas ERP</div>
            <div style="text-align: right; width: 200px; border-top: 1px solid #94a3b8; padding-top: 4px;">Firma de Conformidad</div>
          </div>
        </div>
      `;
}

export function getDeliveryTicketHtml(h: any, provName: string, clientName: string) {
  return `
        <div style="font-family: 'Inter', system-ui, sans-serif; padding: 28px; color: #0f172a; max-width: 600px; margin: 0 auto; border: 2px solid #7c3aed; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h2 style="margin: 0; color: #6d28d9; font-size: 18px; font-weight: 800;">COMPROBANTE DE ENTREGA EN BÁSCULA</h2>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Proveedor: ${provName} · Suministro a ${clientName}</p>
            </div>
            <div style="text-align: right;">
              <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 14px; font-weight: 800; color: #0f172a;">OC ${h.folio}</span>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 18px; border: 1px solid #e2e8f0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
              <div>
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Fecha de Entrega:</span>
                <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${h.date ? new Date(h.date).toLocaleDateString('es-MX', { dateStyle: 'full', timeStyle: 'short' }) : 'Reciente'}</div>
              </div>
              <div>
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Kilos Entregados:</span>
                <div style="font-weight: 900; color: #059669; font-size: 22px; margin-top: 2px;">${h.kilos.toLocaleString('es-MX')} kg</div>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Producto:</span>
                <div style="font-weight: 600; color: #334155; margin-top: 2px;">${h.productDescription || `Polietileno ${clientName}`}</div>
              </div>
              ${h.notes ? `
              <div style="grid-column: 1 / -1; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Chofer / Observaciones:</span>
                <div style="font-weight: 600; color: #1e293b; margin-top: 2px;">${h.notes}</div>
              </div>` : ''}
            </div>
          </div>

          <div style="margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; font-size: 11px; color: #475569;">
            <div>
              <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 700;">Entregó (${provName} / Taller)</div>
            </div>
            <div>
              <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 700;">Recibió (Almacén ${clientName})</div>
            </div>
          </div>
        </div>
      `;
}
