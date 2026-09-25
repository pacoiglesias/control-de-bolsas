import { useState } from 'react';
import { motion } from 'framer-motion';
import { HealthGaugeDial } from '../ui/HealthGaugeDial';
import { useAuditReport } from '../../hooks/useAuditReport';
import { AuditCentinelaModal } from './AuditCentinelaModal';

interface AuditHealthCardProps {
  size?: number;
  className?: string;
}

/**
 * Tarjeta de KPI de Salud del ERP para Dashboard.
 * Integra el HealthGaugeDial animado con acceso directo al
 * Diagnostico Centinela completo con 1 clic.
 */
export function AuditHealthCard({ size = 130, className = '' }: AuditHealthCardProps) {
  const report  = useAuditReport();
  const [open, setOpen] = useState(false);

  const statusText = report.score === 100
    ? 'Sistema Perfecto'
    : report.criticalCount > 0
      ? `${report.criticalCount} Crítica(s)`
      : `${report.warningCount} Alerta(s)`;

  return (
    <>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`kpi-card clickable ${className}`.trim()}
        style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(true)}
        role="button"
        aria-label={`Salud del ERP: ${report.score}%. ${statusText}. Clic para ver diagnóstico completo.`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
      >
        {/* Barra de acento segun salud */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 3,
            background: report.score >= 95
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : report.score >= 80
                ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                : report.score >= 65
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)',
          }}
        />

        <HealthGaugeDial
          score={report.score}
          title="Salud ERP"
          subtitle={statusText}
          size={size}
          style={{ background: 'transparent', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}
        />

        <div className="kpi-sub" style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>
          {report.totalAnomalies === 0
            ? 'Sistema Blindado — 0 Anomalías'
            : `${report.totalAnomalies} punto(s) de atención`}
        </div>
      </motion.div>

      {open && <AuditCentinelaModal report={report} onClose={() => setOpen(false)} />}
    </>
  );
}
