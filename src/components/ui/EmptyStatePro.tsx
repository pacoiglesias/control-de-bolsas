import React from 'react';

interface EmptyStateProProps {
  icon?: 'check-circle' | 'inbox' | 'search' | 'shield' | 'truck' | 'receipt';
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  badgeText?: string;
  badgeType?: 'ok' | 'info' | 'warn';
  style?: React.CSSProperties;
}

export const EmptyStatePro: React.FC<EmptyStateProProps> = ({
  icon = 'check-circle',
  title,
  description,
  actionText,
  onAction,
  badgeText,
  badgeType = 'ok',
  style = {},
}) => {
  const renderIcon = () => {
    switch (icon) {
      case 'check-circle':
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ok)', fontSize: 28, boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
            ✓
          </div>
        );
      case 'search':
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)', fontSize: 26 }}>
            🔍
          </div>
        );
      case 'shield':
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)', fontSize: 26 }}>
            🛡️
          </div>
        );
      case 'truck':
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)', fontSize: 26 }}>
            🚚
          </div>
        );
      case 'receipt':
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warn)', fontSize: 26 }}>
            🧾
          </div>
        );
      default:
        return (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--paper-sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', fontSize: 26 }}>
            📦
          </div>
        );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '36px 20px',
        background: 'var(--paper-raised)',
        border: '1px dashed var(--line)',
        borderRadius: 'var(--radius)',
        ...style,
      }}
    >
      <div style={{ marginBottom: 14 }}>{renderIcon()}</div>

      {badgeText && (
        <span
          className={`badge b-${badgeType}`}
          style={{ marginBottom: 10, fontSize: 11, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {badgeText}
        </span>
      )}

      <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
        {title}
      </h4>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)', maxWidth: 360, lineHeight: 1.5 }}>
        {description}
      </p>

      {actionText && onAction && (
        <button className="btn btn-primary" onClick={onAction} style={{ padding: '8px 18px', fontSize: 13 }}>
          {actionText}
        </button>
      )}
    </div>
  );
};
