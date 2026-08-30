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
        <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
          🚨 CRÍTICA
        </span>
      );
    }
    if (sev === 'warning') {
      return (
        <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
          ⚠️ ATENCIÓN
        </span>
      );
    }
    return (
      <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
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
    <Modal title="🛡️ Diagnóstico Centinela" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        {/* 1. Resumen Ejecutivo Compacto */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: '14px 16px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: getScoreColor(report.score),
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
                lineHeight: 1,
                boxShadow: `0 0 12px ${getScoreColor(report.score)}50`,
                flexShrink: 0,
              }}
            >
              {report.score}%
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.2px' }}>
                {report.score === 100 ? 'ERP Blindado y Conciliado' : 'Auditoría en Vivo'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Báscula, Facturación SAT, Andrés y Caja Chica
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {report.criticalCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                {report.criticalCount} Críticas
              </span>
            )}
            {report.warningCount > 0 && (
              <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                {report.warningCount} Alertas
              </span>
            )}
            {report.criticalCount === 0 && report.warningCount === 0 && (
              <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                ✓ 100% OK
              </span>
            )}
          </div>
        </div>

        {/* 2. Radar Compacto de Subsistemas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
          {Object.entries(report.subsystemHealth).map(([key, sub]) => {
            const iconMap: Record<string, string> = {
              bascula: '⚖️ Báscula',
              facturacion: '🧾 Facturación',
              cobranza: '📑 Providencia',
              maquilaAndres: '🏭 Andrés',
              tesoreriaCaja: '💵 Caja',
            };
            const isOk = sub.status === 'ok';
            return (
              <div
                key={key}
                style={{
                  background: isOk ? 'rgba(16, 185, 129, 0.08)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.25)' : sub.status === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  borderRadius: 8,
                  padding: '6px 8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)' }}>{iconMap[key] || key}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: isOk ? '#059669' : sub.status === 'warning' ? '#d97706' : '#dc2626', marginTop: 2 }}>
                  {isOk ? '✓ Óptimo' : `${sub.score}%`}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Lista de Observaciones / Diagnóstico */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Detalles ({report.totalAnomalies})
            </span>
            {report.totalAnomalies > 0 && (
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
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'all' ? 'Todas' : f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredAnomalies.length === 0 ? (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 10,
                padding: '18px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>🛡️</div>
              <div style={{ fontSize: 13, color: '#065f46', fontWeight: 700 }}>
                ¡Todo el Sistema en Perfecto Balance!
              </div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                Cero descuadres contables o entregas huérfanas detectadas.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredAnomalies.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--paper-raised)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239, 68, 68, 0.35)' : 'var(--line)'}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {getSeverityBadge(a.severity)}
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{a.title}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyAnomalyId === a.id}
                      onClick={() => handleExecuteAction(a)}
                      style={{
                        fontSize: 10.5,
                        padding: '2px 8px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {busyAnomalyId === a.id ? '...' : a.autoFixLabel || 'Ir'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
                    {a.description}
                  </div>
                  {a.financialImpact?.amount && (
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
                      Monto: <strong style={{ color: a.severity === 'critical' ? '#dc2626' : '#d97706' }}>{money(a.financialImpact.amount)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Footer con botón de cerrar claro */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontWeight: 700, padding: '6px 16px', fontSize: 11.5 }}>
            ✕ Cerrar
          </button>
        </div>

      </div>
    </Modal>
  );
}
