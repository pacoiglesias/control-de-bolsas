import { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface HealthGaugeDialProps {
  /** Puntuación de salud numérica entre 0 y 100 */
  score: number;
  title?: string;
  subtitle?: string;
  size?: number;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function HealthGaugeDial({
  score,
  title = 'Salud del ERP',
  subtitle = 'Auditoría Continua Centinela',
  size = 140,
  onClick,
  className = '',
  style,
}: HealthGaugeDialProps) {
  const safeScore = useMemo(() => {
    if (!Number.isFinite(score) || Number.isNaN(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [score]);

  // Determinación de color armónico según puntuación
  const { color, label } = useMemo(() => {
    if (safeScore >= 95) return { color: '#10B981', label: 'Impecable' }; // Esmeralda impecable
    if (safeScore >= 80) return { color: '#3B82F6', label: 'Óptimo' };    // Azul sólido
    if (safeScore >= 65) return { color: '#F59E0B', label: 'Revisión' };  // Ámbar de atención
    return { color: '#F43F5E', label: 'Crítico' };                        // Carmesí crítico
  }, [safeScore]);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Semicírculo
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : 'region'}
      aria-label={`${title}: ${safeScore}% (${label})`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--glass-bg)',
        border: '1px solid var(--line-soft)',
        backdropFilter: 'blur(12px)',
        borderRadius: 'var(--radius)',
        padding: '14px 18px',
        boxShadow: 'var(--shadow)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        outline: 'none',
        ...style,
      }}
      className={`health-gauge-card ${className}`.trim()}
    >
      <div
        style={{ position: 'relative', width: size, height: size / 2 + 16 }}
        role="progressbar"
        aria-valuenow={safeScore}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg
          width={size}
          height={size / 2 + 10}
          viewBox={`0 0 ${size} ${size / 2 + 10}`}
          style={{ overflow: 'visible' }}
          aria-hidden="true"
        >
          {/* Arco de Fondo */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="var(--paper-sunk)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Arco Activo con Animación */}
          <motion.path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${color}66)`,
            }}
          />
        </svg>

        {/* Puntuación Central */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: size > 120 ? 28 : 22,
              fontWeight: 900,
              color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {safeScore}%
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {label}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{subtitle}</div>
      </div>
    </div>
  );
}
