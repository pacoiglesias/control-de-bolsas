import { useMemo } from 'react';
import { money } from '../../lib/format';
import { computeAndresRequirement } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useAndresStats } from '../../hooks/useAndresStats';
import { useNavigate } from 'react-router-dom';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { openPrintHtml } from './orderModalPrint';

interface TabAndresOrderProps {
  order: PurchaseOrder;
  config: FinancialConfig;
  customCostPrice: string | number;
  customSellPrice: string | number;
}

export function TabAndresOrder({ order, config, customCostPrice, customSellPrice }: TabAndresOrderProps) {
  const toast = useToast();
  const nav = useNavigate();
  const { settings } = useSystemSettings();
  const { stats, loading: loadingBalance } = useAndresStats();

  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';

  const req = useMemo(() => {
    const virtualOrder: PurchaseOrder = {
      ...order,
      customCostPrice: customCostPrice !== '' ? Number(customCostPrice) : undefined,
      customSellPrice: customSellPrice !== '' ? Number(customSellPrice) : undefined,
    };
    return computeAndresRequirement(virtualOrder, config);
  }, [order, config, customCostPrice, customSellPrice]);

  // --- Balance vs costo OC ---
  const saldoActual = loadingBalance ? null : (stats?.saldoProveedor ?? 0);
  const costOC = req.costTotal;
  // saldoActual positivo = empresa le pagó de más (crédito a favor de Andrés)
  // negativo = empresa le debe
  // Para iniciar el pedido: si saldo < costOC, se necesita anticipo
  const anticipoNecesario = saldoActual !== null ? Math.max(costOC - Math.max(saldoActual, 0), 0) : null;
  const tieneDeudaPrevia = saldoActual !== null && saldoActual < 0;
  const alcanzaElSaldo = saldoActual !== null && saldoActual >= costOC;

  const tono: 'ok' | 'warn' | 'bad' =
    alcanzaElSaldo ? 'ok' :
    tieneDeudaPrevia ? 'bad' :
    'warn';

  const balanceColors = {
    ok:   { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#047857', badge: '#d1fae5' },
    warn: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#b45309', badge: '#fef3c7' },
    bad:  { bg: 'rgba(239,68,68,0.08)',  border: '#ef4444', text: '#b91c1c', badge: '#fef2f2' },
  }[tono];

  const icono = alcanzaElSaldo ? '✅' : tieneDeudaPrevia ? '🔴' : '⚠️';

  function handleWhatsAppAnticipo() {
    const monto = anticipoNecesario && anticipoNecesario > 0 ? anticipoNecesario : costOC;
    const msg = tieneDeudaPrevia
      ? `Hola ${provName}, para poder iniciar el pedido de OC ${req.folio} (${req.kilos.toLocaleString('es-MX')} kg) necesitamos liquidar el saldo anterior de ${money(Math.abs(saldoActual ?? 0))} más el costo de esta OC de ${money(costOC)}. Total a cubrir: ${money(monto)}. Por favor confírmame cuándo podemos coordinar el anticipo.`
      : `Hola ${provName}, para iniciar el pedido de OC ${req.folio} (${req.kilos.toLocaleString('es-MX')} kg) necesitamos un anticipo de ${money(monto)} (el costo es ${money(costOC)}${saldoActual && saldoActual > 0 ? `, ya tienes ${money(saldoActual)} a tu favor` : ''}). Por favor confírmame cuándo lo podemos arrancar.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

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
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    openPrintHtml(html);
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
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    openPrintHtml(html);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ───── TARJETA DE BALANCE — PRIMERA COSA VISIBLE ───── */}
      <div style={{
        background: balanceColors.bg,
        border: `2px solid ${balanceColors.border}`,
        borderRadius: 14,
        padding: '16px 18px',
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: balanceColors.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {icono} Saldo Actual con {provName} — ¿Se necesita anticipo para esta OC?
        </div>

        {loadingBalance ? (
          <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Calculando saldo…</div>
        ) : (
          <>
            {/* Fila de números */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                {
                  label: 'Saldo con ' + provName,
                  val: money(saldoActual ?? 0),
                  hint: saldoActual !== null && saldoActual >= 0 ? '↑ Crédito disponible' : '↓ Deuda pendiente',
                  color: saldoActual !== null && saldoActual >= 0 ? '#047857' : '#b91c1c',
                },
                {
                  label: 'Costo de esta OC',
                  val: money(costOC),
                  hint: `${req.kilos.toLocaleString('es-MX')} kg × $${req.costPricePerKg.toFixed(2)}`,
                  color: '#b45309',
                },
                alcanzaElSaldo
                  ? { label: 'Estado', val: '✅ Saldo suficiente', hint: 'Puedes hacer el pedido ya', color: '#047857' }
                  : {
                      label: anticipoNecesario && anticipoNecesario > 0 ? 'Anticipo Necesario' : 'A cubrir',
                      val: money(tieneDeudaPrevia ? Math.abs(saldoActual ?? 0) + costOC : (anticipoNecesario ?? costOC)),
                      hint: tieneDeudaPrevia ? 'Deuda anterior + costo OC' : 'Para iniciar producción',
                      color: '#b91c1c',
                    },
              ].map(({ label, val, hint, color }) => (
                <div key={label} style={{ background: 'var(--paper)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color, fontFamily: 'monospace' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>{hint}</div>
                </div>
              ))}
            </div>

            {/* Mensaje de acción */}
            <div style={{
              background: 'var(--paper)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: balanceColors.text,
              marginBottom: 12,
              border: `1px solid ${balanceColors.border}`,
              lineHeight: 1.5,
            }}>
              {alcanzaElSaldo
                ? `✅ ${provName} tiene crédito suficiente (${money(saldoActual ?? 0)}) para cubrir el costo de esta OC (${money(costOC)}). Puedes hacer el pedido sin anticipos.`
                : tieneDeudaPrevia
                ? `🔴 ${provName} tiene una deuda anterior de ${money(Math.abs(saldoActual ?? 0))} más el costo de esta OC (${money(costOC)}). Total a cubrir antes de iniciar: ${money(Math.abs(saldoActual ?? 0) + costOC)}.`
                : `⚠️ ${provName} tiene crédito de ${money(saldoActual ?? 0)} pero la OC cuesta ${money(costOC)}. Necesitas anticipar ${money(anticipoNecesario ?? 0)} para iniciar la producción.`
              }
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!alcanzaElSaldo && (
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid #25D366', color: '#128C7E', fontWeight: 700, fontSize: 12 }}
                  onClick={handleWhatsAppAnticipo}
                >
                  💬 WhatsApp: Solicitar Anticipo
                </button>
              )}
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12 }}
                onClick={() => nav('/compras')}
              >
                🏦 Ver Cuentas Completas con {provName}
              </button>
            </div>
          </>
        )}
      </div>
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
              <span>🏭</span> Requerimiento de Producción para {provName}
              <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: 11 }}>
                Entrega Directa a {clientName}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              Basado en la OC <strong>{req.folio}</strong> de <strong>{req.client}</strong>. {provName} entrega directo en planta sin mermas en taller.
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
              title={`Generar remisión para que ${provName} entregue en ${clientName}`}
            >
              <span>📄</span> Remisión {clientName}
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
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Costo {provName} ($/kg)</div>
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
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Costo {provName}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Venta {clientName}</th>
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
          <span>💬</span> Vista Previa del Mensaje de WhatsApp para {provName}
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
