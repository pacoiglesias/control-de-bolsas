import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PurchaseOrder } from '../../lib/types';
import { fmtDate, money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { computeClientReportMetrics, pct } from '../../lib/clientReportTypes';
import { buildClientReportWhatsappMsg } from '../../lib/clientReportWhatsApp';
import { printClientReport } from '../../lib/clientReportPrint';
import { exportClientReportToExcel } from '../../lib/clientReportExcel';

interface OcClientStatusReportProps {
  order: PurchaseOrder;
  onClose: () => void;
}

export const OcClientStatusReport: React.FC<OcClientStatusReportProps> = ({ order, onClose }) => {
  const { settings } = useSystemSettings();
  const [copied, setCopied] = useState(false);

  const metrics = useMemo(() => computeClientReportMetrics(order), [order]);
  const empresa = settings?.companyName || 'Elemental Denim Bolsas';
  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Cliente';
  const nextDateStr = metrics.nextDate ? fmtDate(metrics.nextDate) : 'Por confirmar';
  const fulfillColor = metrics.fulfillPct >= 98 ? '#10b981' : metrics.fulfillPct >= 50 ? '#3b82f6' : '#f59e0b';

  const handlePrint = () => {
    triggerHaptic('medium');
    printClientReport({ order, metrics, companyName: empresa });
  };

  const handleWhatsApp = () => {
    triggerHaptic('medium');
    const msg = buildClientReportWhatsappMsg({ order, metrics, companyName: empresa });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleEmail = () => {
    triggerHaptic('light');
    const subject = encodeURIComponent(`Reporte de Avance OC ${folio} — ${empresa}`);
    const body = encodeURIComponent(
      buildClientReportWhatsappMsg({ order, metrics, companyName: empresa })
        .replace(/\*/g, '')
        .replace(/_/g, '')
    );
    const email = order.clientEmail || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopy = async () => {
    triggerHaptic('light');
    try {
      const msg = buildClientReportWhatsappMsg({ order, metrics, companyName: empresa });
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleExportExcel = () => {
    triggerHaptic('medium');
    exportClientReportToExcel({ order, metrics, companyName: empresa });
  };

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            width: '100%', maxWidth: 860, maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(160deg, #0f172a 0%, #0a0f1e 100%)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 20,
            boxShadow: '0 32px 64px -12px rgba(0,0,0,0.9), 0 0 40px rgba(59,130,246,0.12)',
            color: '#f1f5f9',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(90deg, rgba(59,130,246,0.08), transparent)',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                📊 Reporte de Avance · Orden de Compra
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>OC {folio}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                {client} · {empresa}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={handleCopy} style={btnStyle('#475569')}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
              <button onClick={handleEmail} style={btnStyle('#4f46e5')}>
                ✉️ Email
              </button>
              <button onClick={handleWhatsApp} style={btnStyle('#16a34a')}>
                📲 WhatsApp
              </button>
              <button onClick={handlePrint} style={btnStyle('#0369a1')}>
                🖨️ PDF / Imprimir
              </button>
              <button onClick={handleExportExcel} style={btnStyle('#059669')}>
                📊 Excel
              </button>
              <button
                onClick={onClose}
                aria-label="Cerrar modal"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <KpiTile label="Total OC" value={`${metrics.totalKg.toLocaleString('es-MX')} kg`} sub={`OC ${folio}`} color="#94a3b8" />
              <KpiTile label="✅ Entregado" value={`${metrics.deliveredKg.toLocaleString('es-MX')} kg`} sub={`${metrics.fulfillPct}% del total`} color="#10b981" />
              <KpiTile label="⏳ Faltante" value={`${metrics.remainingKg.toLocaleString('es-MX')} kg`} sub={money(metrics.pendingAmount) + ' c/IVA'} color={metrics.remainingKg > 0 ? '#f59e0b' : '#10b981'} />
              <KpiTile label="📅 Próxima Entrega" value={nextDateStr} sub={`${metrics.remainingKg.toLocaleString('es-MX')} kg comprometidos`} color="#60a5fa" />
            </div>

            {/* Barra de progreso */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                <span>Avance de Cumplimiento</span>
                <span style={{ color: fulfillColor }}>{metrics.fulfillPct}%</span>
              </div>
              <div style={{ height: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.fulfillPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 8,
                    background: `linear-gradient(90deg, ${fulfillColor}, ${fulfillColor}cc)`,
                    boxShadow: `0 0 12px ${fulfillColor}55`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                <span>{metrics.deliveredKg.toLocaleString('es-MX')} kg entregados</span>
                <span>{metrics.remainingKg.toLocaleString('es-MX')} kg restantes</span>
              </div>
            </div>

            {/* Entregas */}
            {metrics.deliveries.length > 0 && (
              <section>
                <SectionTitle>🚚 Historial de Entregas</SectionTitle>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={thS}>#</th>
                      <th style={thS}>Fecha</th>
                      <th style={thS}>Documento</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Kilos</th>
                      <th style={{ ...thS, textAlign: 'center' }}>Factura</th>
                      <th style={thS}>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.deliveries.map((d, i) => (
                      <tr key={d.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={tdS}><span style={{ fontWeight: 700, color: '#94a3b8' }}>{i + 1}</span></td>
                        <td style={tdS}><span style={{ fontWeight: 600, color: '#e2e8f0' }}>{d.date ? fmtDate(d.date) : '—'}</span></td>
                        <td style={tdS}>
                          {d.docFolio
                            ? <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Rem. {d.docFolio}</span>
                            : <span style={{ color: '#64748b' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(d.kilos).toLocaleString('es-MX')} kg
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {d.invoiced
                            ? <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✅ Facturado</span>
                            : <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>⏳ Pdte. Factura</span>}
                        </td>
                        <td style={{ ...tdS, color: '#64748b', fontSize: 12, maxWidth: 200 }}>{d.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                      <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', fontWeight: 700, fontSize: 12 }}>TOTAL ENTREGADO:</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: 15 }}>{metrics.deliveredKg.toLocaleString('es-MX')} kg</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </section>
            )}

            {/* Detalle por partida */}
            {metrics.items.length > 0 && (
              <section>
                <SectionTitle>📋 Detalle por Partida</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {metrics.items.map((it, i) => {
                    const pedido = Number(it.quantity);
                    const entregado = Number(it.deliveredQuantity || 0);
                    const falta = Math.max(0, pedido - entregado);
                    const pctIt = pct(entregado, pedido);
                    const barCol = pctIt >= 100 ? '#10b981' : pctIt >= 50 ? '#3b82f6' : '#f59e0b';
                    return (
                      <div key={it.id || i} style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10, padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{it.description}</div>
                            {it.code && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{it.code}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 13, textAlign: 'right', flexShrink: 0 }}>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>PEDIDO</div>
                              <div style={{ fontWeight: 700, color: '#94a3b8' }}>{pedido.toLocaleString('es-MX')} kg</div>
                            </div>
                            <div>
                              <div style={{ color: '#10b981', fontSize: 10, fontWeight: 700 }}>ENTREGADO</div>
                              <div style={{ fontWeight: 800, color: '#10b981' }}>{entregado.toLocaleString('es-MX')} kg</div>
                            </div>
                            <div>
                              <div style={{ color: falta > 0 ? '#f59e0b' : '#10b981', fontSize: 10, fontWeight: 700 }}>FALTANTE</div>
                              <div style={{ fontWeight: 800, color: falta > 0 ? '#f59e0b' : '#10b981' }}>
                                {falta > 0 ? `${falta.toLocaleString('es-MX')} kg` : '✅'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pctIt}%` }}
                              transition={{ duration: 0.7, delay: i * 0.05 }}
                              style={{ height: '100%', background: barCol, borderRadius: 4 }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{pctIt}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Resumen financiero */}
            <section>
              <SectionTitle>💰 Resumen Financiero</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>Material Entregado (c/IVA)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', marginTop: 4 }}>{money(metrics.deliveredAmountIva)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{metrics.deliveredKg.toLocaleString('es-MX')} kg × ${metrics.salePrice}/kg + IVA</div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>Pendiente de Entrega (c/IVA)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>{money(metrics.pendingAmount)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{metrics.remainingKg.toLocaleString('es-MX')} kg restantes · Fecha: {nextDateStr}</div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.2)', fontSize: 12, color: '#64748b',
          }}>
            <span>Reporte generado el {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</span>
            <button onClick={onClose} style={{
              padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
            }}>Cerrar</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: `${color}cc`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 4, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 10,
      paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {children}
    </div>
  );
}

const thS: React.CSSProperties = { padding: '6px 10px', fontWeight: 700 };
const tdS: React.CSSProperties = { padding: '9px 10px' };

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: `${bg}22`, border: `1px solid ${bg}66`,
    color: '#f1f5f9', padding: '7px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
    minHeight: 36, transition: 'background 0.15s',
  };
}
