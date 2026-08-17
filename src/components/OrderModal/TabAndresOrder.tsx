import { useMemo } from 'react';
import { money } from '../../lib/format';
import { computeAndresRequirement } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';

interface TabAndresOrderProps {
  order: PurchaseOrder;
  config: FinancialConfig;
  customCostPrice: string | number;
  customSellPrice: string | number;
}

export function TabAndresOrder({ order, config, customCostPrice, customSellPrice }: TabAndresOrderProps) {
  const toast = useToast();

  const req = useMemo(() => {
    const virtualOrder: PurchaseOrder = {
      ...order,
      customCostPrice: customCostPrice !== '' ? Number(customCostPrice) : undefined,
      customSellPrice: customSellPrice !== '' ? Number(customSellPrice) : undefined,
    };
    return computeAndresRequirement(virtualOrder, config);
  }, [order, config, customCostPrice, customSellPrice]);

  function handleCopyText() {
    navigator.clipboard.writeText(req.whatsappMessage);
    toast('📋 Pedido copiado al portapapeles', 'ok');
  }

  function handlePrintOrder() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Orden de Producción / Pedido - Andrés</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; font-size: 13px; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18px; font-weight: 800; color: #0f172a; }
            .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 6px; font-weight: 700; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; padding: 14px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            .num { text-align: right; font-family: monospace; }
            .notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ORDEN DE PRODUCCIÓN / PEDIDO DE MAQUILA</div>
              <div style="color: #64748b; margin-top: 4px;">Proveedor Fabricante: <strong>Andrés</strong></div>
            </div>
            <div class="badge">OC Ref: ${req.folio}</div>
          </div>

          <div class="grid">
            <div>
              <div><strong>Cliente Destino:</strong> ${req.client}</div>
              <div><strong>Lugar de Entrega:</strong> Entrega directa en planta Providencia</div>
            </div>
            <div>
              <div><strong>Kilos Totales:</strong> ${req.kilos.toLocaleString('es-MX')} kg</div>
              <div><strong>Costo por Kilo:</strong> $${req.costPricePerKg.toFixed(2)}</div>
              <div><strong>Importe Total Compra:</strong> $${req.costTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <h3>Detalle de Bolsas y Medidas Requeridas</h3>
          <table>
            <thead>
              <tr>
                <th>Cantidad / Kilos</th>
                <th>Unidad</th>
                <th>Descripción / Medidas / Calibre</th>
              </tr>
            </thead>
            <tbody>
              ${req.items.length > 0 ? req.items.map(it => `
                <tr>
                  <td class="num" style="text-align: left; font-weight: bold;">${it.quantity.toLocaleString('es-MX')}</td>
                  <td>${it.unit || 'kg'}</td>
                  <td>${it.description || 'Bolsa de polietileno'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td class="num" style="text-align: left; font-weight: bold;">${req.kilos.toLocaleString('es-MX')}</td>
                  <td>KGM</td>
                  <td>Bolsa de polietileno a granel</td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="notice">
            <strong>Instrucciones Importantes:</strong><br/>
            1. El material debe entregarse directamente en la planta del cliente (${req.client}).<br/>
            2. Solicitar y recabar la firma / sello de la remisión de entrega de Providencia y compartir comprobante para contrarecibo.<br/>
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  function handlePrintRemision() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Remisión de Entrega en Planta - ${req.client}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; font-size: 13px; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 20px; font-weight: 800; color: #065f46; }
            .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 14px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background: #f8fafc; font-weight: 700; color: #334155; }
            .num { text-align: right; font-family: monospace; font-size: 14px; font-weight: bold; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
            .sig-box { border-top: 2px solid #64748b; padding-top: 10px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">REMISIÓN DE ENTREGA DE MERCANCÍA</div>
              <div style="color: #64748b; margin-top: 4px;">Entrega Directa de Andrés a Planta <strong>${req.client}</strong></div>
            </div>
            <div class="badge">ORDEN DE COMPRA: ${req.folio}</div>
          </div>

          <div class="grid">
            <div>
              <div><strong>Destino:</strong> Almacén Central Providencia</div>
              <div><strong>Fecha de Salida:</strong> ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</div>
            </div>
            <div>
              <div><strong>Total de Kilos a Entregar:</strong> <span style="font-size: 16px; color: #059669; font-weight: 800;">${req.kilos.toLocaleString('es-MX')} kg</span></div>
              <div><strong>Transporte / Chofer:</strong> Entrega Andrés</div>
            </div>
          </div>

          <h3>Detalle de Material a Recibir</h3>
          <table>
            <thead>
              <tr>
                <th>Kilos / Cantidad</th>
                <th>Unidad</th>
                <th>Descripción de Material / Calibre</th>
                <th style="text-align: center;">Conforme</th>
              </tr>
            </thead>
            <tbody>
              ${req.items.length > 0 ? req.items.map(it => `
                <tr>
                  <td class="num" style="text-align: left;">${it.quantity.toLocaleString('es-MX')}</td>
                  <td>${it.unit || 'kg'}</td>
                  <td>${it.description || 'Bolsa de polietileno'}</td>
                  <td style="text-align: center;">[  ]</td>
                </tr>
              `).join('') : `
                <tr>
                  <td class="num" style="text-align: left;">${req.kilos.toLocaleString('es-MX')}</td>
                  <td>KGM</td>
                  <td>Bolsa de polietileno a granel</td>
                  <td style="text-align: center;">[  ]</td>
                </tr>
              `}
            </tbody>
          </table>

          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; font-size: 12px; margin-top: 20px;">
            <strong>Nota para el Almacén:</strong> Favor de sellar y firmar de recibido esta remisión con los kilos pesados en báscula para trámite de contrarecibo.
          </div>

          <div class="signatures">
            <div class="sig-box">Entregó: Andrés (Transportista / Fabricante)</div>
            <div class="sig-box">Recibió Conforme: Almacén Providencia (Sello y Firma)</div>
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumen Principal de Requerimiento */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(37,99,235,0.12) 100%)',
          border: '1px solid #3b82f6',
          borderRadius: 12,
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏭</span> Requerimiento de Producción para Andrés
              <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: 11 }}>
                Entrega Directa a Providencia
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              Basado en la OC <strong>{req.folio}</strong> de <strong>{req.client}</strong>. Andrés entrega directo en planta sin mermas en taller.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{
                borderColor: '#059669',
                color: '#047857',
                background: 'rgba(5,150,105,0.1)',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onClick={handlePrintRemision}
              title="Generar remisión para que Andrés entregue en Providencia"
            >
              <span>📄</span> Remisión Providencia
            </button>

            <button
              type="button"
              className="btn"
              style={{ fontSize: 12 }}
              onClick={handleCopyText}
              title="Copiar texto del pedido"
            >
              📋 Copiar
            </button>

            <button
              type="button"
              className="btn"
              style={{ fontSize: 12 }}
              onClick={handlePrintOrder}
              title="Imprimir Orden de Maquila en PDF"
            >
              🖨️ Imprimir OC
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas de la Compra */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
          <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Kilos Requeridos</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace' }}>
              {req.kilos.toLocaleString('es-MX')} kg
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Costo Andrés ($/kg)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', fontFamily: 'monospace' }}>
              ${req.costPricePerKg.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Costo Total Compra</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bad)', fontFamily: 'monospace' }}>
              {money(req.costTotal)}
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Utilidad Líquida Est.</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: req.netProfitEst >= 0 ? 'var(--ok)' : 'var(--bad)', fontFamily: 'monospace' }}>
              {money(req.netProfitEst)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 600 }}>
              +${req.profitPerKg.toFixed(2)} / kg
            </div>
          </div>
        </div>
      </div>

      {/* Partidas de Producto Detalladas */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--ink)' }}>
          📋 Detalle de Medidas y Calibres a Fabricar
        </div>

        {req.items.length > 0 ? (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-faint)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Cantidad</th>
                  <th style={{ padding: '6px 8px' }}>Unidad</th>
                  <th style={{ padding: '6px 8px' }}>Descripción de Medidas / Calibre</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Costo Andrés ($42)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Venta Providencia ($43)</th>
                </tr>
              </thead>
              <tbody>
                {req.items.map((it, idx) => {
                  const qty = Number(it.quantity) || 0;
                  const itemCost = qty * req.costPricePerKg;
                  const itemSale = qty * req.salePricePerKg;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {qty.toLocaleString('es-MX')}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--ink-soft)' }}>{it.unit || 'kg'}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{it.description || 'Bolsa de polietileno'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--bad)' }}>
                        {money(itemCost)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--ok)' }}>
                        {money(itemSale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--ink-soft)', fontSize: 12, padding: '12px 0' }}>
            Esta orden fue registrada por volumen total ({req.kilos.toLocaleString('es-MX')} kg) sin partidas individuales.
          </div>
        )}
      </div>

      {/* Vista Previa del Mensaje para Andrés */}
      <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💬</span> Vista Previa del Mensaje de WhatsApp para Andrés
        </div>
        <pre
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--line-soft)',
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            margin: 0,
            color: 'var(--ink)',
            lineHeight: 1.4,
          }}
        >
          {req.whatsappMessage}
        </pre>
      </div>
    </div>
  );
}
