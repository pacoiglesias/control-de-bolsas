import type { CSSProperties } from 'react';

export type IconProps = { size?: number; color?: string; style?: CSSProperties; className?: string };

const base = (size: number, color?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: color || 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconTrendingUp({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="14 6 21 6 21 13" />
    </svg>
  );
}

export function IconBank({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconWallet({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <path d="M16 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4z" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export function IconFactory({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 20V10l6 4v-4l6 4V6l6 4v10H3Z" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconPackage({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconClipboardList({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8 11h8M8 14h8M8 17h5" />
    </svg>
  );
}

export function IconRefresh({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconLogout({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconLayoutDashboard({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

export function IconFolder({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function IconTruck({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M14 8h4l3 3v6a1 1 0 0 1-1 1h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

export function IconZap({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconShoppingBag({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function IconShoppingCart({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

export function IconCoins({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h2M7 10h2M15 14h2M15 18h2" />
    </svg>
  );
}

export function IconScale({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

export function IconChartBar({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" />
      <path d="M11 16V8" />
      <path d="M15 16v-6" />
      <path d="M19 16V4" />
    </svg>
  );
}

export function IconSettings({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconUsers({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconEye({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff({ size = 20, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function IconSearch({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}

export function IconFilter({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function IconDownload({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export function IconUpload({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

export function IconCheckCircle({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function IconPlus({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

export function IconTrash({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function IconCalendar({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

export function IconClock({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconFileText({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

export function IconChevronRight({ size = 18, color, style, className }: IconProps) {
  return (
    <svg {...base(size, color)} style={style} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
