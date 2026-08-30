import { motion } from 'framer-motion';

interface HealthGaugeDialProps {
  score: number; // 0 to 100
  title?: string;
  subtitle?: string;
  size?: number;
  onClick?: () => void;
}

export function HealthGaugeDial({
  score,
  title = 'Salud del ERP',
  subtitle = 'Auditoría Continua Centinela',
  size = 140,
  onClick,
}: HealthGaugeDialProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determinación de color armónico según puntuación
  const getColor = (s: number) => {
    if (s >= 95) return '#10B981'; // Esmeralda impecable
    if (s >= 80) return '#3B82F6'; // Azul sólido
    if (s >= 65) return '#F59E0B'; // Ámbar de atención
    return '#F43F5E';            // Carmesí crítico
  };

  const color = getColor(safeScore);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Semicírculo
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div
      onClick={onClick}
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
      }}
      className="health-gauge-card"
    >
      <div style={{ position: 'relative', width: size, height: size / 2 + 16 }}>
        <svg
          width={size}
          height={size / 2 + 10}
          viewBox={`0 0 ${size} ${size / 2 + 10}`}
          style={{ overflow: 'visible' }}
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
          <span style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
            {safeScore === 100 ? 'Impecable' : safeScore >= 80 ? 'Óptimo' : safeScore >= 60 ? 'Revisión' : 'Crítico'}
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
