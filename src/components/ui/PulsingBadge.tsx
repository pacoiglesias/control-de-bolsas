import React from 'react';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';

interface PulsingBadgeProps {
  label: string;
  tone?: BadgeTone;
  pulse?: boolean;
  icon?: string;
  count?: number | string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const TONE_STYLES: Record<BadgeTone, { bg: string; text: string; border: string; pulseClass: string }> = {
  green: {
    bg: 'rgba(16, 185, 129, 0.15)',
    text: '#34d399',
    border: 'rgba(16, 185, 129, 0.35)',
    pulseClass: 'badge-pulse-green',
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.35)',
    pulseClass: 'badge-pulse-amber',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#f87171',
    border: 'rgba(239, 68, 68, 0.35)',
    pulseClass: 'badge-pulse-red',
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.35)',
    pulseClass: '',
  },
  purple: {
    bg: 'rgba(168, 85, 247, 0.15)',
    text: '#c084fc',
    border: 'rgba(168, 85, 247, 0.35)',
    pulseClass: '',
  },
  gray: {
    bg: 'rgba(255, 255, 255, 0.08)',
    text: '#9ca3af',
    border: 'rgba(255, 255, 255, 0.15)',
    pulseClass: '',
  },
};

export const PulsingBadge: React.FC<PulsingBadgeProps> = ({
  label,
  tone = 'gray',
  pulse = false,
  icon,
  count,
  onClick,
  style = {},
}) => {
  const config = TONE_STYLES[tone] || TONE_STYLES.gray;
  const pulseClass = pulse ? config.pulseClass : '';

  return (
    <span
      onClick={onClick}
      className={pulseClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        ...style,
      }}
    >
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '1px 6px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
};
