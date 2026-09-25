import { useState } from 'react';
import { useAuditReport } from '../../hooks/useAuditReport';
import { AuditCentinelaModal } from './AuditCentinelaModal';

export function AuditCentinelaBadge() {
  const report = useAuditReport();
  const [openModal, setOpenModal] = useState(false);

  const isPerfect   = report.score === 100 && report.totalAnomalies === 0;
  const hasCritical = report.criticalCount > 0;

  // Silencio operativo: badge invisible cuando todo esta en orden
  if (isPerfect || (report.criticalCount === 0 && report.warningCount === 0)) {
    return null;
  }

  const badgeColor  = hasCritical ? '#ef4444' : '#f59e0b';
  const badgeBg     = hasCritical ? 'rgba(239,68,68,0.15)'  : 'rgba(245,158,11,0.15)';
  const badgeBorder = hasCritical ? 'rgba(239,68,68,0.4)'   : 'rgba(245,158,11,0.4)';

  return (
    <>
      <button
        type="button"
        className="centinela-badge"
        onClick={() => setOpenModal(true)}
        title={`Centinela ERP: Score ${report.score}/100 (${report.totalAnomalies} observaciones). Clic para diagnosticar.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: badgeBg,
          border: `1px solid ${badgeBorder}`,
          borderRadius: 20,
          padding: '4px 10px',
          color: badgeColor,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: 13, transform: 'scale(1.1)', display: 'inline-block' }}>
          {hasCritical ? '🚨' : '⚠️'}
        </span>
        <span style={{ letterSpacing: '0.2px' }}>CENTINELA {report.score}%</span>
        {report.totalAnomalies > 0 && (
          <span style={{
            background: badgeColor,
            color: '#fff',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 800,
            marginLeft: 2,
          }}>
            {report.totalAnomalies}
          </span>
        )}
      </button>

      {openModal && (
        <AuditCentinelaModal report={report} onClose={() => setOpenModal(false)} />
      )}
    </>
  );
}
