/**
 * FIX (v8.9.3): mejora visual pedida explícitamente -- cambiar los emojis
 * (📈🏦💵⚠️🏭📋 etc.) por íconos reales. Se hicieron a mano en vez de
 * instalar una librería de íconos (lucide-react, heroicons, etc.) para no
 * meter una dependencia nueva -- con su propio riesgo de tamaño de bundle y
 * de romper algo en un parche que ya toca mucho -- por un cambio que es
 * puramente visual. Mismo espíritu que ya usa `public/favicon.svg`: SVG de
 * trazo simple, geométrico, en `currentColor` para heredar el color del
 * texto de alrededor sin código extra.
 *
 * Este set cubre las pantallas de mayor visibilidad (Dashboard, Portal
 * Maquilador). El resto de los emojis repartidos por las demás pantallas
 * queda documentado como pendiente en el CHANGELOG -- es un barrido mucho
 * más grande que no cabía completo en este parche sin apurarlo.
 */
import type { CSSProperties } from 'react';

export type IconProps = { size?: number; style?: CSSProperties; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconTrendingUp({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="14 6 21 6 21 13" />
    </svg>
  );
}

export function IconBank({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconWallet({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <path d="M16 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4z" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export function IconFactory({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 20V10l6 4v-4l6 4V6l6 4v10H3Z" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconPackage({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconClipboardList({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8 11h8M8 14h8M8 17h5" />
    </svg>
  );
}

export function IconRefresh({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconLogout({ size = 22, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
