import React, { useMemo } from 'react';
import { runContinuousAutoAudit } from '../../lib/auditEngine';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface CentinelaLivePillProps {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  expenses: Expense[];
  config?: FinancialConfig;
  onClick: () => void;
}

export const CentinelaLivePill: React.FC<CentinelaLivePillProps> = ({
  orders,
  purchases,
  expenses,
  config,
  onClick,
}) => {
  const auditReport = useMemo(() => {
    return runContinuousAutoAudit({
      orders: orders || [],
      purchases: purchases || [],
      expenses: expenses || [],
      config,
    });
  }, [orders, purchases, expenses, config]);

  const score = auditReport.score;
  const critical = auditReport.criticalCount;
  const warnings = auditReport.warningCount;

  const isWarning = score >= 75 && score < 90;
  const isCritical = score < 75 || critical > 0;

  const bg = isCritical
    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.2) 100%)'
    : isWarning
    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.2) 100%)'
    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.18) 100%)';

  const border = isCritical
    ? 'rgba(239, 68, 68, 0.6)'
    : isWarning
    ? 'rgba(245, 158, 11, 0.6)'
    : 'rgba(16, 185, 129, 0.5)';

  const textColor = isCritical ? '#f87171' : isWarning ? '#fbbf24' : '#34d399';
  const icon = isCritical ? '🛑' : isWarning ? '⚠️' : '🛡️';

  const label = isCritical
    ? `${score}% (${critical} críticas)`
    : isWarning
    ? `${score}% (${warnings} alertas)`
    : `${score}% Óptimo`;

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        onClick();
      }}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: textColor,
        fontWeight: 900,
        fontSize: 12.5,
        padding: '8px 14px',
        borderRadius: 12,
        boxShadow: `0 4px 14px ${isCritical ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      title={`Auto-Auditoría Continua Centinela: Salud del ERP al ${score}%. Clic para ver reporte y auto-corrección.`}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>Centinela {label}</span>
    </button>
  );
};
