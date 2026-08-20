// Constantes y estilos compartidos entre MaquiladorPortal.tsx y
// MaquiladorPortalPinScreen.tsx. Extraidos de MaquiladorPortal.tsx (que
// llegaba a 1796 lineas) para que la pantalla de PIN pudiera separarse a su
// propio archivo sin duplicar estas definiciones.

/* ─── Estilos Glassmorphism Premium ────────────────────────────────────────── */
export const glass = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

export const kpiCard = (accent: string, bg = 'rgba(255, 255, 255, 0.05)') => ({
  ...glass,
  background: bg,
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  borderLeft: `4px solid ${accent}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
});

export const STORAGE_PIN_KEY = 'maquila_saved_pin_v2';
export const STORAGE_DELIVERIES_KEY = 'maquila_recent_deliveries_v2';
export const STORAGE_OFFLINE_QUEUE_KEY = 'maquila_offline_queue_v2';
