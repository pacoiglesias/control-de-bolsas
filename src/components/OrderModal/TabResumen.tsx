import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderModal } from './OrderModalContext';
import { Field, StatusBadge } from '../ui';
import { PasteTextModal } from '../PasteTextModal';
import { OCPreviewModal } from '../OCPreviewModal';
import { fromInputDate, money, toInputDate, kilos } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { confirmDialog } from '../../lib/confirmDialog';
import { parseOrdenDeCompra, type ParsedOC } from '../../lib/ocParser';
import { usePurchases } from '../../hooks/usePurchases';

export default function TabResumen() {
  const ctx = useOrderModal();
  const nav = useNavigate();
  const { purchases } = usePurchases();
  const [pegandoOC, setPegandoOC] = useState(false);
  const [preview, setPreview] = useState<ParsedOC | null>(null);
  if (!ctx) return null;
  const {
    form,
    set,
    readOnly,
    liveSummary,
    provName,
    fallbackSale,
    fallbackCost,
    fallbackComm,
    kilosNum,
    applyParsedOC,
    emailClient,
    toast,
    setTab,
    order,
  } = ctx;

  const compraLigada = purchases.find((p) => p.id === order.id);

  // Cálculo de margen unitario en tiempo real
  const sellP = parseFloat(form.customSellPrice || '') || fallbackSale || 43;
  const costP = parseFloat(form.customCostPrice || '') || fallbackCost || 38;
  const margenUnitario = Math.max(0, sellP - costP);

  return (
    <>
      {pegandoOC && (
        <PasteTextModal
          title="Pegar texto de la OC"
          placeholder="Pega aquí el texto completo copiado de la Orden de Compra (OC)…"
          onConfirm={(text) => {
            setPegandoOC(false);
            setPreview(parseOrdenDeCompra(text));
          }}
          onClose={() => setPegandoOC(false)}
        />
      )}
      {preview && (
        <OCPreviewModal
          parsed={preview}
          onConfirm={() => {
            applyParsedOC(preview);
            setPreview(null);
          }}
          onCancel={() => setPreview(null)}
        />
      )}

      {/* Barra superior de herramientas y chips de estado de facturación */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setPegandoOC(true)}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12.5,
            padding: '7px 12px',
            border: 'none',
            borderRadius: 8,
          }}
        >
          📋 Pegar Texto de OC (Autollenado)
        </button>

        {form.invoices.length > 0 && (() => {
          const conteo = { overdue: 0, pending: 0, paid: 0, collected: 0 };
          for (const inv of form.invoices) {
            const st = inv.creditCycle?.status;
            if (st && st in conteo) conteo[st as keyof typeof conteo]++;
          }
          const chips = [
            { key: 'overdue', label: 'Vencidas', color: 'var(--bad)', bg: 'rgba(239, 68, 68, 0.12)' },
            { key: 'pending', label: 'Por Cobrar', color: 'var(--ink)', bg: 'var(--paper-sunk)' },
            { key: 'paid', label: 'Con Contador', color: 'var(--warn)', bg: 'rgba(245, 158, 11, 0.12)' },
            { key: 'collected', label: 'Cobradas', color: 'var(--ok)', bg: 'rgba(16, 185, 129, 0.12)' },
          ] as const;
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                Facturas:
              </span>
              {chips
                .filter((c) => conteo[c.key] > 0)
                .map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setTab('facturas')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 9px',
                      borderRadius: 12,
                      border: `1px solid ${c.color}`,
                      background: c.bg,
                      color: c.color,
                      fontWeight: 700,
                      fontSize: 11.5,
                      cursor: 'pointer',
                    }}
                    title="Ver en pestaña Facturas"
                  >
                    <span>{conteo[c.key]}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
            </div>
          );
        })()}
      </div>

      {/* Grid de Formulario Compacto & Organizado */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '16px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Bloque 1: Identificación y Cliente */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            1. Datos del Pedido & Cliente
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            <Field label="Folio Interno">
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13 }}
                defaultValue={form.folio}
                onBlur={(e) => set('folio', e.target.value)}
                disabled={readOnly}
              />
            </Field>

            <Field label="No. OC Providencia">
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13 }}
                placeholder="Ej. 120267114014"
                defaultValue={(form as any).oc}
                onBlur={(e) => set('oc' as any, e.target.value)}
                disabled={readOnly}
              />
            </Field>

            <Field label="Cliente">
              <input
                className="input boxed"
                style={{ padding: '6px 10px', fontSize: 13 }}
                list="known-clients"
                defaultValue={form.client}
                onBlur={(e) => set('client', e.target.value)}
                disabled={readOnly}
              />
            </Field>

            <Field label="Departamento (TH / GT)">
              <input
                className="input boxed"
                style={{ padding: '6px 10px', fontSize: 13 }}
                list="known-departments"
                placeholder="Ej. TH o GT"
                defaultValue={form.department}
                onBlur={(e) => set('department', e.target.value)}
                disabled={readOnly}
              />
            </Field>

            <Field label="Kilos Pedidos (Total)">
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                type="number"
                step="0.01"
                defaultValue={form.totalKilograms}
                onBlur={(e) => set('totalKilograms', e.target.value)}
                disabled={readOnly}
              />
            </Field>

            <Field label="Proveedor Maquila">
              <input
                className="input boxed"
                style={{ padding: '6px 10px', fontSize: 13 }}
                list="known-providers"
                defaultValue={form.provider}
                onBlur={(e) => set('provider', e.target.value)}
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--line-soft)' }} />

        {/* Bloque 2: Precios, Costos y Fecha de Entrega */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            2. Precios $/kg & Logística
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <Field label="Precio Venta $/kg">
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}
                type="number"
                step="0.01"
                onBlur={(e) => set('customSellPrice', e.target.value)}
                defaultValue={form.customSellPrice}
                disabled={readOnly}
                placeholder={`Ej. ${fallbackSale}`}
              />
            </Field>

            <Field label={`Costo Compra (${provName})`}>
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                type="number"
                step="0.01"
                onBlur={(e) => set('customCostPrice', e.target.value)}
                defaultValue={form.customCostPrice}
                disabled={readOnly}
                placeholder={`Ej. ${fallbackCost}`}
              />
              {compraLigada && (
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 4, fontSize: 10.5, padding: '2px 6px', width: '100%' }}
                  onClick={() => nav(`/compras?abrir=${order.id}`)}
                >
                  🏭 Ver en Andrés →
                </button>
              )}
            </Field>

            <Field label="Margen Bruto $/kg">
              <div
                style={{
                  padding: '6px 10px',
                  background: 'var(--paper-sunk)',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--ok)',
                  fontFamily: 'monospace',
                }}
              >
                +${margenUnitario.toFixed(2)}/kg
              </div>
            </Field>

            <Field label="Comisión Contador %">
              <input
                className="input boxed mono"
                style={{ padding: '6px 10px', fontSize: 13 }}
                type="number"
                step="0.01"
                onBlur={(e) => set('customCommissionRate', e.target.value)}
                defaultValue={form.customCommissionRate}
                disabled={readOnly}
                placeholder={`Ej. ${(fallbackComm * 100).toFixed(1)}`}
              />
            </Field>

            <Field label="Promesa Entrega">
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  className="input boxed mono"
                  style={{ padding: '6px 8px', fontSize: 12, flex: 1 }}
                  type="date"
                  value={toInputDate(form.estimatedDeliveryDate) || ''}
                  onChange={(e) => {
                    const d = fromInputDate(e.target.value);
                    set('estimatedDeliveryDate', d ? Timestamp.fromDate(d) : null);
                  }}
                  disabled={readOnly}
                />
                {form.clientEmail && (
                  <button
                    type="button"
                    className="btn"
                    onClick={emailClient}
                    title="Notificar por correo"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                  >
                    ✉️
                  </button>
                )}
              </div>
            </Field>
          </div>
        </div>
      </div>

      {/* Bloque 3: Estado Global & Balanza Compacta */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Balance del Expediente
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Estatus:</span>
            <StatusBadge status={liveSummary.status} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {/* Métricas de Kilos */}
          <div style={{ background: 'var(--paper-sunk)', padding: '10px 12px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Volumen de Kilos
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Pedidos:</span>
              <strong className="mono">{kilos(kilosNum)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Entregados:</span>
              <strong className="mono" style={{ color: liveSummary.kilosDelivered < kilosNum ? 'var(--warn)' : 'var(--ok)' }}>
                {kilos(liveSummary.kilosDelivered)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Facturados:</span>
              <strong className="mono">{kilos(liveSummary.kilosInvoiced)}</strong>
            </div>
          </div>

          {/* Métricas Financieras */}
          <div style={{ background: 'var(--paper-sunk)', padding: '10px 12px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Facturación & Cobro
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Total Facturado:</span>
              <strong className="mono">{money(liveSummary.invoiceTotal)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Cobrado en Cuenta:</span>
              <strong className="mono" style={{ color: 'var(--ok)' }}>{money(liveSummary.paidAmount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, borderTop: '1px dashed var(--line-soft)', paddingTop: 4 }}>
              <span>Saldo por Cobrar:</span>
              <strong className="mono" style={{ color: liveSummary.invoiceTotal - liveSummary.paidAmount > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                {money(Math.max(0, liveSummary.invoiceTotal - liveSummary.paidAmount))}
              </strong>
            </div>
          </div>

          {/* Utilidad y Rendimiento */}
          <div style={{ background: 'var(--paper-sunk)', padding: '10px 12px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Utilidad Proyectada
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Ganancia Estimada:</span>
              <strong className="mono" style={{ color: 'var(--ok)' }}>{money(liveSummary.netCashFlow)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Utilidad Cobrada:</span>
              <strong className="mono">{money(liveSummary.realizedProfit)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, borderTop: '1px dashed var(--line-soft)', paddingTop: 4 }}>
              <span>Comisión Contador:</span>
              <strong className="mono" style={{ color: 'var(--warn)' }}>
                {money(liveSummary.saleTotal * (fallbackComm || 0.08))}
              </strong>
            </div>
          </div>
        </div>

        {/* Acciones de Conclusión / Reapertura */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {form.isClosedShort ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="badge" style={{ background: '#2563eb', color: '#fff', fontSize: 11.5, fontWeight: 700 }}>
                🔒 Concluido ({liveSummary.kilosDelivered.toLocaleString('es-MX')} kg)
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => {
                    set('isClosedShort', false);
                    toast('🔓 Pedido reabierto para nuevas entregas.', 'ok');
                  }}
                >
                  🔓 Reabrir
                </button>
              )}
            </div>
          ) : (
            !readOnly &&
            kilosNum - liveSummary.kilosDelivered > 0.01 &&
            liveSummary.kilosDelivered > 0 && (
              <button
                type="button"
                className="btn"
                style={{ background: '#0f172a', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '5px 10px' }}
                onClick={async () => {
                  if (
                    await confirmDialog(
                      `¿Confirmas concluir y cerrar este pedido con los ${liveSummary.kilosDelivered.toLocaleString('es-MX')} kg entregados?\n\nYa no se esperarán más entregas de ${provName} para esta OC y podrás facturarla al 100%.`
                    )
                  ) {
                    set('isClosedShort', true);
                    toast('🔒 Pedido concluido con los kilos entregados. Haz clic en "Guardar cambios".', 'ok');
                  }
                }}
              >
                🔒 Concluir Pedido con {liveSummary.kilosDelivered.toLocaleString('es-MX')} kg
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
