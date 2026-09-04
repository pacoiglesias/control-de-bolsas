import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'dark' | 'light';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  className = '',
  style = {},
  variant = 'dark',
}) => {
  const shimmerClass = variant === 'light' ? 'skeleton-shimmer-light' : 'skeleton-shimmer';

  return (
    <div
      className={`${shimmerClass} ${className}`}
      style={{
        width,
        height,
        borderRadius,
        display: 'inline-block',
        ...style,
      }}
    />
  );
};

export const CardSkeleton: React.FC<{ rows?: number; style?: React.CSSProperties }> = ({
  rows = 3,
  style = {},
}) => {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <Skeleton height={24} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={16} width={`${85 - i * 15}%`} />
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ cols?: number; rows?: number }> = ({
  cols = 4,
  rows = 5,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={18} width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            background: r % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderRadius: 8,
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={16} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};
