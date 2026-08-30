import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui';
import { money } from '../../lib/format';
import type { AuditHealthReport, AuditAnomaly } from '../../lib/auditEngine';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';

interface AuditCentinelaModalProps {
  report: AuditHealthReport;
  onClose: () => void;
}

export function AuditCentinelaModal({
  report,
  onClose,
}: AuditCentinelaModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [busyAnomalyId, setBusyAnomalyId] = useState<string | null>(null);

  const filteredAnomalies = report.anomalies.filter((a) => {
    if (selectedFilter === 'all') return true;
    return a.severity === selectedFilter;
  });

  const getScoreColor = (score: number) => {
    if (score >= 95) return '#10b981';
    if (score >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityBadge = (sev: AuditAnomaly['severity']) => {
    if (sev === 'critical') {
      return (
        <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          🚨 CRÍTICA
        </span>
      );
    }
    if (sev === 'warning') {
      return (
        <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          ⚠️ ATENCIÓN
        </span>
      );
    }
    return (
      <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
        💡 SUGERENCIA
      </span>
    );
  };

  async function handleExecuteAction(anomaly: AuditAnomaly) {
    setBusyAnomalyId(anomaly.id);
    triggerHaptic('light');

    try {
      if (anomaly.autoFixType === 'align_oc_to_deliveries' && anomaly.orderId) {
        const orderRef = doc(db, PATHS.orders, anomaly.orderId);
        await updateDoc(orderRef, {
          isClosedShort: true,
          updatedAt: Timestamp.now(),
        });
        triggerHaptic('success');
        sound.playSuccess();
        toast(`✅ OC sincronizada y cerrada al volumen real entregado.`, 'ok');
      } else if (anomaly.autoFixType === 'open_invoice_modal') {
        onClose();
        navigate('/ordenes');
        toast(`Facturación: Selecciona la orden en Expedientes para facturar.`, 'ok');
      } else if (anomaly.autoFixType === 'calibrate_andres') {
        onClose();
        navigate('/compras');
        toast(`Dirígete a la sección Andrés para calibrar el saldo.`, 'ok');
      } else if (anomaly.autoFixType === 'calibrate_caja') {
        onClose();
        navigate('/caja-chica');
        toast(`Dirígete a Caja Chica para registrar ingresos o arqueo.`, 'ok');
      } else if (anomaly.orderId) {
        onClose();
        navigate('/ordenes');
      } else {
        toast(anomaly.recommendation, 'ok');
      }
    } catch (err: any) {
      toast(`Error: ${err.message}`, 'bad');
    } finally {
      setBusyAnomalyId(null);
    }
  }

  return (
    <Modal title="🛡️ CENTINELA: Diagnóstico de Salud del ERP" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '78vh', overflowY: 'auto', padding: '4px 2px' }}>
        
        {/* 1. Header con Indicador de Salud Global */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 14,
            padding: '16px 20px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(report.score)} ${report.score * 3.6}deg, rgba(255, 255, 255, 0.1) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 16px ${getScoreColor(report.score)}40`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#0f172a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(report.score), lineHeight: 1 }}>
                  {report.score}
                </span>
                <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  / 100
                </span>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px' }}>
                  {report.score === 100 ? 'ERP 100% BLINDADO Y AUDITADO' : 'AUDITORÍA CONTINUA EN VIVO'}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', maxWidth: 520, lineHeight: 1.35 }}>
                El Centinela supervisa automáticamente tolerancias de báscula, facturación SAT, cuentas de Andrés y balance de caja chica.
              </p>
            </div>
          </div>

          {/* Mini Estadísticas */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>{report.criticalCount}</div>
              <div style={{ fontSize: 9.5, color: '#fca5a5', fontWeight: 600 }}>Críticas</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>{report.warningCount}</div>
              <div style={{ fontSize: 9.5, color: '#fde68a', fontWeight: 600 }}>Atención</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{report.infoCount}</div>
              <div style={{ fontSize: 9.5, color: '#93c5fd', fontWeight: 600 }}>Sugerencias</div>
            </div>
          </div>
        </div>

        {/* 2. Radar de los 5 Subsistemas Operativos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {Object.entries(report.subsystemHealth).map(([key, sub]) => {
            const iconMap: Record<string, string> = {
              bascula: '⚖️ Báscula & Patio',
              facturacion: '🧾 Facturación SAT',
              cobranza: '📑 Providencia',
              maquilaAndres: '🏭 Andrés',
              tesoreriaCaja: '💵 Caja Chica',
            };
            const isOk = sub.status === 'ok';
            return (
              <div
                key={key}
                style={{
                  background: isOk ? 'rgba(16, 185, 129, 0.06)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                  border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.25)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  borderRadius: 10,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{iconMap[key] || key}</div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isOk ? '#059669' : sub.status === 'warning' ? '#d97706' : '#dc2626' }}>
                    {isOk ? '✓ Óptimo' : sub.status === 'warning' ? '⚠️ Alerta' : '🚨 Descuadre'}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)' }}>{sub.score}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Filtros y Lista de Diagnóstico */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)', letterSpacing: '0.4px' }}>
              Observaciones ({report.totalAnomalies})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFilter(f)}
                  style={{
                    background: selectedFilter === f ? 'var(--primary)' : 'var(--paper-raised)',
                    color: selectedFilter === f ? '#fff' : 'var(--ink-soft)',
                    border: '1px solid var(--line)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10.5,
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
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 30 }}>🛡️</span>
              <h4 style={{ margin: '6px 0 2px 0', fontSize: 14, color: '#065f46', fontWeight: 800 }}>
                ¡Todo el Sistema se Encuentra Conciliado!
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: '#047857' }}>
                No hay anomalías contables, entregas desfasadas ni discrepancias en caja.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
              {filteredAnomalies.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--paper-raised)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239, 68, 68, 0.35)' : a.severity === 'warning' ? 'rgba(245, 158, 11, 0.35)' : 'var(--line)'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {getSeverityBadge(a.severity)}
                        <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{a.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.35 }}>
                        {a.description}
                      </p>
                    </div>

                    {/* Botón de Acción Limpio */}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyAnomalyId === a.id}
                      onClick={() => handleExecuteAction(a)}
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                        flexShrink: 0,
                        background: a.severity === 'critical' ? '#dc2626' : 'var(--primary)',
                        borderColor: a.severity === 'critical' ? '#dc2626' : 'var(--primary)',
                      }}
                    >
                      {busyAnomalyId === a.id ? '...' : a.autoFixLabel || 'Ver Detalle'}
                    </button>
                  </div>

                  {/* Causa & Recomendación */}
                  <div
                    style={{
                      background: 'var(--paper-sunk)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>Causa: </span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.rootCause}</span>
                    </div>
                    {a.financialImpact?.amount && (
                      <div style={{ color: 'var(--ink)', fontWeight: 700 }}>
                        Monto: <span style={{ color: a.severity === 'critical' ? '#dc2626' : '#d97706' }}>{money(a.financialImpact.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Footer con botón de cerrar claro */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontWeight: 700, padding: '6px 18px', fontSize: 12 }}>
            ✕ Cerrar Centinela
          </button>
        </div>

      </div>
    </Modal>
  );
}
