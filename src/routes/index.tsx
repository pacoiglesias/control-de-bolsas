import { lazy } from 'react';

/**
 * Rutas declarativas y lazy imports para code-splitting del ERP
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/',
  ORDERS: '/ordenes',
  COBRANZA: '/cobranza',
  CAJA_CHICA: '/caja-chica',
  COMPRAS: '/compras',
  CONTROL_CENTER: '/centro-control',
  AUDIT: '/audit',
  OC_TRACKING: '/oc',
  DATA_MINING: '/mining',
  CATALOG: '/catalogo',
  FAST_ENTRY: '/captura-rapida',
  USERS: '/usuarios',
  PORTAL_MAQUILADOR: '/portal-maquilador',
} as const;

export const LazyPages = {
  MaquiladorPortal: lazy(() => import('../pages/MaquiladorPortal')),
  Dashboard: lazy(() => import('../pages/Dashboard')),
  Orders: lazy(() => import('../pages/Orders')),
  Cobranza: lazy(() => import('../components/Cobranza')),
  CajaChica: lazy(() => import('../pages/CajaChica')),
  Compras: lazy(() => import('../pages/Compras')),
  ControlCenter: lazy(() => import('../pages/ControlCenter')),
  OcTracking: lazy(() => import('../pages/OcTracking')),
  Catalog: lazy(() => import('../pages/Catalog')),
  FastEntry: lazy(() => import('../pages/FastEntry').then(m => ({ default: m.FastEntry }))),
  AuditSync: lazy(() => import('../pages/AuditSync')),
  DataMining: lazy(() => import('../pages/DataMining')),
  Users: lazy(() => import('../pages/Users')),
};
