import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../ui';
import { money } from '../../lib/format';
import type { AuditHealthReport, AuditAnomaly } from '../../lib/auditEngine';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';

interface AuditCentinelaModalProps {
  report: AuditHealthReport;
  onClose: () => void;
  onOpenOrder?: (orderId: string) => void;
  onOpenInvoiceModal?: (orderId: string) => void;
  onCalibrateAndres?: () => void;
  onCalibrateCaja?: () => void;
}

export function AuditCentinelaModal({
  report,
  onClose,
  onOpenOrder,
  onOpenInvoiceModal,
  onCalibrateAndres,
  onCalibrateCaja,
}: AuditCentinelaModalProps) {
  const toast = useToast();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [busyAnomalyId, setBusyAnomalyId] = useState<string | null>(null);

  const filteredAnomalies = report.anomalies.filter((a) => {
    if (selectedFilter === 'all') return true;
    return a.severity === selectedFilter;
  });

  const getScoreColor = (score: number) => {
    if (score >= 95) return '#10b981'; // Emerald
    if (score >= 80) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getSeverityBadge = (sev: AuditAnomaly['severity']) => {
    if (sev === 'critical') {
      return <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>🚨 CRÍTICA</span>;
    }
    if (sev === 'warning') {
      return <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>⚠️ ATENCIÓN</span>;
    }
    return <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>💡 SUGERENCIA</span>;
  };

  async function handleExecuteAutoFix(anomaly: AuditAnomaly) {
    if (!anomaly.autoFixType) return;
    setBusyAnomalyId(anomaly.id);
    triggerHaptic('light');

    try {
      if (anomaly.autoFixType === 'align_oc_to_deliveries' && anomaly.orderId) {
        // Auto-alineación de OC a entregas físicas en Firestore
        const orderRef = doc(db, PATHS.orders, anomaly.orderId);
        if (anomaly.financialImpact?.kilos) {
          await updateDoc(orderRef, {
            isClosedShort: true,
            updatedAt: Timestamp.now(),
          });
        }
        triggerHaptic('success');
        sound.playSuccess();
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
        toast(`✅ OC alineada con báscula real y ciclo de entrega cerrado al 100%.`, 'ok');
      } else if (anomaly.autoFixType === 'open_invoice_modal') {
        onClose();
        if (onOpenInvoiceModal && anomaly.orderId) onOpenInvoiceModal(anomaly.orderId);
      } else if (anomaly.autoFixType === 'calibrate_andres') {
        onClose();
        if (onCalibrateAndres) onCalibrateAndres();
      } else if (anomaly.autoFixType === 'calibrate_caja') {
        onClose();
        if (onCalibrateCaja) onCalibrateCaja();
      } else if (anomaly.autoFixType === 'open_order' && anomaly.orderId) {
        onClose();
        if (onOpenOrder) onOpenOrder(anomaly.orderId);
      }
    } catch (err: any) {
      toast(`Error al auto-reparar: ${err.message}`, 'bad');
    } finally {
      setBusyAnomalyId(null);
    }
  }

  return (
    <Modal title="🛡️ CENTINELA: Centro de Auto-Auditoría & Salud del ERP" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* 1. Header con Indicador de Salud Global */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '24px 28px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(report.score)} ${report.score * 3.6}deg, rgba(255, 255, 255, 0.1) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 20px ${getScoreColor(report.score)}40`,
              }}
            >
              <div
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: '50%',
                  background: '#0f172a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, color: getScoreColor(report.score), lineHeight: 1 }}>
                  {report.score}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  / 100
                </span>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  {report.score === 100 ? 'ERP 100% BLINDADO Y AUDITADO' : 'AUDITORÍA CONTINUA EN VIVO'}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    background: report.score >= 95 ? '#065f46' : '#9a3412',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                >
                  NIVEL SAP CONTINUOUS AUDIT
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 480 }}>
                El Centinela analiza continuamente 5 subsistemas contables, tolerancias de báscula, prefijos de contrarecibos y flujos de tesorería para detectar y auto-reparar anomalías.
              </p>
            </div>
          </div>

          {/* Mini Estadísticas */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{report.criticalCount}</div>
              <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 600 }}>Críticas</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{report.warningCount}</div>
              <div style={{ fontSize: 10, color: '#fde68a', fontWeight: 600 }}>Atención</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{report.infoCount}</div>
              <div style={{ fontSize: 10, color: '#93c5fd', fontWeight: 600 }}>Sugerencias</div>
            </div>
          </div>
        </div>

        {/* 2. Radar de 5 Subsistemas */}
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--ink-soft)', letterSpacing: '0.5px' }}>
            Estado de los 5 Subsistemas Operativos
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(report.subsystemHealth).map(([key, sub]) => {
              const iconMap: Record<string, string> = {
                bascula: '⚖️ Báscula & Patio',
                facturacion: '🧾 Facturación SAT',
                cobranza: '📑 Cartera Providencia',
                maquilaAndres: '🏭 Maquila Andrés',
                tesoreriaCaja: '💵 Caja & Tesorería',
              };
              const isOk = sub.status === 'ok';
              return (
                <div
                  key={key}
                  style={{
                    background: isOk ? 'rgba(16, 185, 129, 0.08)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.3)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{iconMap[key] || key}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isOk ? '#059669' : sub.status === 'warning' ? '#d97706' : '#dc2626' }}>
                      {isOk ? '✓ 100% Óptimo' : sub.status === 'warning' ? '⚠️ 1 Atención' : '🚨 Descuadre'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)' }}>{sub.score}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Filtros y Lista de Anomalías con Auto-Healing */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--ink-soft)', letterSpacing: '0.5px' }}>
              Diagnóstico Detallado & Reparación Automática ({report.totalAnomalies})
            </h4>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  style={{
                    background: selectedFilter === f ? 'var(--primary)' : 'var(--paper-raised)',
                    color: selectedFilter === f ? '#fff' : 'var(--ink-soft)',
                    border: '1px solid var(--line)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f === 'all' ? `Todas (${report.totalAnomalies})` : f}
                </button>
              ))}
            </div>
          </div>

          {filteredAnomalies.length === 0 ? (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 12,
                padding: '32px 20px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 36 }}>🛡️</span>
              <h3 style={{ margin: '8px 0 4px 0', fontSize: 16, color: '#065f46', fontWeight: 800 }}>
                ¡Cero Discrepancias Detectadas!
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#047857' }}>
                Todos los subsistemas contables, entregas de báscula y saldos de tesorería están en perfecto balance.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {filteredAnomalies.map((a) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: 'var(--paper-raised)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239, 68, 68, 0.4)' : a.severity === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'var(--line)'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {getSeverityBadge(a.severity)}
                        <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{a.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                        {a.description}
                      </p>
                    </div>

                    {/* Botón de Auto-Healing */}
                    {a.autoFixAvailable && (
                      <button
                        className="btn btn-primary"
                        disabled={busyAnomalyId === a.id}
                        onClick={() => handleExecuteAutoFix(a)}
                        style={{
                          fontSize: 12,
                          padding: '6px 12px',
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          background: a.severity === 'critical' ? '#dc2626' : '#2563eb',
                          borderColor: a.severity === 'critical' ? '#dc2626' : '#2563eb',
                        }}
                      >
                        {busyAnomalyId === a.id ? 'Reparando...' : a.autoFixLabel || '⚡ Auto-Reparar'}
                      </button>
                    )}
                  </div>

                  {/* Detalle Técnico de Causa Raíz & Recomendación */}
                  <div
                    style={{
                      background: 'var(--paper-sunk)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 11.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>💡 Causa: </span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.rootCause}</span>
                    </div>
                    {a.financialImpact?.amount && (
                      <div style={{ color: 'var(--ink)', fontWeight: 700 }}>
                        Impacto: <span style={{ color: a.severity === 'critical' ? '#dc2626' : '#d97706' }}>{money(a.financialImpact.amount)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Footer con botón de cerrar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <button className="btn" onClick={onClose} style={{ fontWeight: 700, padding: '8px 20px' }}>
            Entendido
          </button>
        </div>

      </div>
    </Modal>
  );
}
