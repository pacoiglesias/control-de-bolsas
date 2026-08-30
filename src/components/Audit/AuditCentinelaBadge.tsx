import { useMemo, useState } from 'react';
import { useOrdersContext } from '../../context/OrdersContext';
import { usePurchases } from '../../hooks/usePurchases';
import { useExpenses } from '../../hooks/useExpenses';
import { useConfig } from '../../hooks/useConfig';
import { runContinuousAutoAudit } from '../../lib/auditEngine';
import { AuditCentinelaModal } from './AuditCentinelaModal';

export function AuditCentinelaBadge({
  onOpenOrder,
  onOpenInvoiceModal,
  onCalibrateAndres,
  onCalibrateCaja,
}: {
  onOpenOrder?: (orderId: string) => void;
  onOpenInvoiceModal?: (orderId: string) => void;
  onCalibrateAndres?: () => void;
  onCalibrateCaja?: () => void;
}) {
  const { orders } = useOrdersContext();
  const { purchases } = usePurchases();
  const { expenses } = useExpenses();
  const { config } = useConfig();

  const [openModal, setOpenModal] = useState(false);

  const report = useMemo(() => {
    return runContinuousAutoAudit({
      orders: orders || [],
      purchases: purchases || [],
      expenses: expenses || [],
      config: config as any,
    });
  }, [orders, purchases, expenses, config]);

  const isPerfect = report.score === 100 && report.totalAnomalies === 0;
  const hasCritical = report.criticalCount > 0;

  const badgeColor = isPerfect
    ? '#10b981' // Verde esmeralda
    : hasCritical
    ? '#ef4444' // Rojo
    : '#f59e0b'; // Ámbar

  const badgeBg = isPerfect
    ? 'rgba(16, 185, 129, 0.12)'
    : hasCritical
    ? 'rgba(239, 68, 68, 0.15)'
    : 'rgba(245, 158, 11, 0.15)';

  const badgeBorder = isPerfect
    ? 'rgba(16, 185, 129, 0.35)'
    : hasCritical
    ? 'rgba(239, 68, 68, 0.4)'
    : 'rgba(245, 158, 11, 0.4)';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        title={
          isPerfect
            ? '🛡️ Centinela ERP: 100% Saludable (0 Anomalías contables o de báscula). Clic para abrir reporte.'
            : `🛡️ Centinela ERP: Score ${report.score}/100 (${report.totalAnomalies} observaciones). Clic para auto-reparar.`
        }
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
        <span style={{ fontSize: 13, display: 'inline-block', transform: isPerfect ? 'none' : 'scale(1.1)' }}>
          {isPerfect ? '🛡️' : hasCritical ? '🚨' : '⚠️'}
        </span>
        <span style={{ letterSpacing: '0.2px' }}>
          {isPerfect ? 'CENTINELA 100%' : `CENTINELA ${report.score}%`}
        </span>
        {report.totalAnomalies > 0 && (
          <span
            style={{
              background: badgeColor,
              color: '#fff',
              borderRadius: 10,
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 800,
              marginLeft: 2,
            }}
          >
            {report.totalAnomalies}
          </span>
        )}
      </button>

      {openModal && (
        <AuditCentinelaModal
          report={report}
          onClose={() => setOpenModal(false)}
          onOpenOrder={onOpenOrder}
          onOpenInvoiceModal={onOpenInvoiceModal}
          onCalibrateAndres={onCalibrateAndres}
          onCalibrateCaja={onCalibrateCaja}
        />
      )}
    </>
  );
}
