import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DuplicateMatch } from '../../lib/duplicateGuards';

interface DuplicateRadarAlertProps {
  match: DuplicateMatch | null;
  onInspect?: (orderFolio: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const TYPE_LABELS: Record<DuplicateMatch['type'], { title: string; icon: string; color: string }> = {
  oc: {
    title: 'Orden de Compra Ya Registrada',
    icon: '📑',
    color: '#d97706',
  },
  invoice: {
    title: 'Folio de Factura Duplicado',
    icon: '🧾',
    color: '#dc2626',
  },
  uuid: {
    title: 'UUID Fiscal SAT Ya Registrado',
    icon: '🛡️',
    color: '#dc2626',
  },
  cr: {
    title: 'Contrarecibo Ya Asignado',
    icon: '📌',
    color: '#d97706',
  },
  remision: {
    title: 'Remisión de Báscula Ya Existente',
    icon: '🚚',
    color: '#ea580c',
  },
};

export const DuplicateRadarAlert: React.FC<DuplicateRadarAlertProps> = ({
  match,
  onInspect,
  className = '',
  style = {},
}) => {
  if (!match || !match.exists) return null;

  const info = TYPE_LABELS[match.type] || {
    title: 'Registro Duplicado Detectado',
    icon: '⚠️',
    color: '#dc2626',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`duplicate-radar-alert ${className}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(254, 243, 199, 0.95)',
          border: `1.5px solid ${info.color}`,
          color: '#78350f',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.15)',
          fontSize: 13,
          lineHeight: 1.4,
          margin: '6px 0',
          ...style,
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{info.icon}</span>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: info.color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{info.title}</span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 999,
                background: info.color,
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              RADAR ERP
            </span>
          </div>

          <div style={{ marginTop: 3, color: '#451a03' }}>
            El valor <strong>"{match.matchedValue}"</strong> ya está asociado a la orden{' '}
            <strong style={{ color: '#1e293b' }}>{match.orderFolio}</strong>
            {match.invoiceFolio && match.invoiceFolio !== match.matchedValue && (
              <> (Factura: <strong>{match.invoiceFolio}</strong>)</>
            )}
            {match.client && <> — <em>{match.client}</em></>}
            {match.dateStr && <> ({match.dateStr})</>}.
          </div>
        </div>

        {onInspect && (
          <button
            type="button"
            onClick={() => onInspect(match.orderFolio)}
            style={{
              flexShrink: 0,
              alignSelf: 'center',
              background: '#fff',
              border: `1px solid ${info.color}`,
              color: info.color,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Ver expediente en el sistema"
          >
            Ver orden ➔
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
