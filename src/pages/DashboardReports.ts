import { getPrintHeaderHtml } from '../lib/format';

// Extraido de Dashboard.tsx: generador puro de HTML para el Reporte de
// Rentabilidad (Utilidad Comercial). Sin efectos secundarios -- solo arma
// un string de HTML a partir de lo que recibe por parametro -- asi que
// separarlo es de bajo riesgo. Dashboard.tsx conserva printRentabilidad()/
// shareRentabilidad() (que si tocan Blob/window/toast) y solo llaman a esta
// funcion para obtener el HTML.

export function getRentabilidadHtml(settings: any, k: any, config: any) {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Utilidad Comercial</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .flow-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
            .flow-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
            .flow-row:last-child { border-bottom: none; }
            .flow-label { font-weight: 600; color: #475569; }
            .flow-val { font-family: monospace; font-size: 15px; }
            .flow-total { font-weight: 800; font-size: 18px; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte de Rentabilidad (Utilidad Comercial)")}

          <div style="margin-bottom: 24px; font-size: 14px; color: #475569; font-weight: 500;">
            ${k.periodText}
          </div>

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL VENDIDO</div><div class="kpi-val">$${k.ventasTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">UTILIDAD BRUTA (MARGIN)</div><div class="kpi-val" style="color: #047857;">$${k.margenTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">GANANCIA LÍQUIDA EN CAJA</div><div class="kpi-val" style="color: #2563eb;">$${k.gananciaRealizadaTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>Cascada Financiera: Deuda Proyectada</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">1. Dinero en la calle (Por cobrar):</span><span class="flow-val">$${(k.porCobrar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">2. Mercancía entregada pendiente de facturar:</span><span class="flow-val">$${(k.montoPendienteFacturar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Deuda Bruta de Providencia:</span><span class="flow-val" style="color: #b91c1c;">$${k.deudaTotalProvidencia.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">Menos Comisión Contable Estimada:</span><span class="flow-val" style="color: #047857;">-$${k.comisionContable.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Dinero Real a Recibir (Neto):</span><span class="flow-val" style="color: #2563eb;">$${k.dineroRealARecibir.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
          </div>

          <h3>Métricas Operativas</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">Kilos Procesados:</span><span class="flow-val">${k.kilosTotal.toLocaleString('es-MX')} kg</span></div>
            <div class="flow-row"><span class="flow-label">Facturas Emitidas:</span><span class="flow-val">${k.facturasEmitidas.toLocaleString('es-MX')} facturas</span></div>
            <div class="flow-row"><span class="flow-label">Órdenes Atendidas:</span><span class="flow-val">${k.totalOrders.toLocaleString('es-MX')} OC's</span></div>
            <div class="flow-row"><span class="flow-label">Costo por Kilo Base:</span><span class="flow-val">$${(config?.costPricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
            <div class="flow-row"><span class="flow-label">Venta por Kilo Base:</span><span class="flow-val">$${(config?.salePricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
          </div>

          <div class="signatures">
            <div class="sig-box">Elaborado Por</div>
            <div class="sig-box">Aprobado / Revisado</div>
          </div>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
}
