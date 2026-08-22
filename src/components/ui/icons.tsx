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

export type IconProps = { size?: number; style?: CSSProperties; className?: string; color?: string };

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

export function IconTrendingUp({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="14 6 21 6 21 13" />
    </svg>
  );
}

export function IconBank({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconWallet({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <path d="M16 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4z" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export function IconFactory({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M3 20V10l6 4v-4l6 4V6l6 4v10H3Z" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconPackage({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconClipboardList({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8 11h8M8 14h8M8 17h5" />
    </svg>
  );
}

export function IconRefresh({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconLogout({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * FIX (v8.9.5): mejora visual pedida explicitamente -- el barrido de v8.9.3
 * solo cubrio Dashboard y Portal Maquilador (ver nota arriba). Este set
 * extiende el mismo lenguaje visual (SVG de trazo, currentColor, sin
 * libreria externa) al menu lateral completo (Layout.tsx), que hasta ahora
 * seguia mostrando emojis crudos -- incluidos dos repetidos por accidente
 * (💵 en Cobranza y en Efectivo en Caja, ⚖️ en Auditoria y en Portal
 * Bascula), lo cual quedaba poco profesional.
 */
export function IconGrid({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconTruck({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18.3" r="1.7" />
      <circle cx="17.5" cy="18.3" r="1.7" />
    </svg>
  );
}

export function IconZap({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function IconShoppingBag({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function IconBanknote({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9h.01M18 15h.01" />
    </svg>
  );
}

export function IconShoppingCart({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}

export function IconSearch({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconScale({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M12 3v18" />
      <path d="M8 21h8" />
      <path d="M5 7h14" />
      <path d="M5 7 2.5 13a2.7 2.7 0 0 0 5 0L5 7Z" />
      <path d="M19 7l-2.5 6a2.7 2.7 0 0 0 5 0L19 7Z" />
    </svg>
  );
}

export function IconSliders({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M4 6h10M18 6h2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M4 12h2M10 12h10" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 18h10M18 18h2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

export function IconUsers({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.3 13.1a4.4 4.4 0 0 1 6.2 4" />
    </svg>
  );
}

/**
 * FIX (v8.9.5, parte 2): estos 6 iconos ya se usaban en vivo en Cobranza,
 * Caja Chica, Compras y Expedientes (alguien ya habia avanzado el barrido
 * de "reemplazar emojis" que quedo documentado como pendiente en v8.9.3 /
 * v8.9.4) pero nunca se llegaron a definir aqui -- typecheck lo marco con
 * "Module has no exported member" en cuanto se corrio limpio. Se agregan
 * con el mismo lenguaje visual del resto del set.
 */
export function IconDownload({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function IconClock({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconCoins({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M3 11v4c0 1.66 2.69 3 6 3s6-1.34 6-3v-1" />
    </svg>
  );
}

export function IconCheckCircle({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

export function IconFileText({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8.5 8.5h3M8.5 12h7M8.5 15.5h7" />
    </svg>
  );
}

export function IconPlus({ size = 22, style, className, color }: IconProps) {
  return (
    <svg {...base(size)} style={color ? { color, ...style } : style} className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
