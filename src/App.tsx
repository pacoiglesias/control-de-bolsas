import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { UndoProvider } from './context/UndoContext';
import { OrdersProvider } from './context/OrdersContext';
import { PurchasesProvider } from './context/PurchasesContext';
import { ProductsProvider } from './context/ProductsContext';
import { ExpensesProvider } from './context/ExpensesContext';
import { InvoicesProvider } from './context/InvoicesContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';
import { llenarEspejoDeFacturas } from './lib/fillInvoicesMirror';

// Cada pantalla se carga bajo demanda: antes las trece se importaban de forma
// estatica y viajaban todas en el chunk principal, Recharts incluido pese a
// que solo lo usa Dashboard. Con lazy() cada ruta va a su propio chunk y el
// navegador solo baja lo que la persona realmente visita.
const MaquiladorPortal = lazy(() => import('./pages/MaquiladorPortal'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Cobranza = lazy(() => import('./components/Cobranza'));
const CajaChica = lazy(() => import('./pages/CajaChica'));
const Compras = lazy(() => import('./pages/Compras'));
const ControlCenter = lazy(() => import('./pages/ControlCenter'));
const OcTracking = lazy(() => import('./pages/OcTracking'));
const Catalog = lazy(() => import('./pages/Catalog'));
const FastEntry = lazy(() => import('./pages/FastEntry').then(m => ({ default: m.FastEntry })));
const AuditSync = lazy(() => import('./pages/AuditSync'));
const DataMining = lazy(() => import('./pages/DataMining'));

function RouteFallback() {
  return (
    <motion.div 
      className="page" 
      style={{ padding: 20 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ width: '40%', height: 32, marginBottom: 8, borderRadius: 8 }}></div>
        <div className="skeleton" style={{ width: '60%', height: 16, borderRadius: 6 }}></div>
      </div>
      <div className="kpi-grid">
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
      </div>
    </motion.div>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <InvoicesProvider>
      <OrdersProvider>
        <PurchasesProvider>
          <ProductsProvider>
            <ExpensesProvider>
              <ToastProvider>
                <UndoProvider>
                  {children}
                </UndoProvider>
              </ToastProvider>
            </ExpensesProvider>
          </ProductsProvider>
        </PurchasesProvider>
      </OrdersProvider>
    </InvoicesProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!user) return;
    const YA_CORRIO = 'cb_migracion_espejo_facturas_v1';
    if (localStorage.getItem(YA_CORRIO)) return;
    llenarEspejoDeFacturas()
      .then(({ expedientes, facturas }) => {
        localStorage.setItem(YA_CORRIO, '1');
        console.log(`Espejo de facturas: ${facturas} facturas copiadas de ${expedientes} expedientes.`);
      })
      .catch((e) => console.warn('No se pudo llenar el espejo de facturas:', e));
  }, [user]);
  if (loading) {
    return (
      <div className="page" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--base)' }}>
        <span className="spinner" style={{ marginBottom: 16 }} />
        <div style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Cargando ERP...</div>
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <ErrorBoundary>
      <AppProviders>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
            <Route path="ordenes" element={<Suspense fallback={<RouteFallback />}><Orders /></Suspense>} />
            <Route path="cobranza" element={<Suspense fallback={<RouteFallback />}><Cobranza /></Suspense>} />
            <Route path="caja-chica" element={<Suspense fallback={<RouteFallback />}><CajaChica /></Suspense>} />
            <Route path="compras" element={<Suspense fallback={<RouteFallback />}><Compras /></Suspense>} />
            <Route path="centro-control" element={<Suspense fallback={<RouteFallback />}><ControlCenter /></Suspense>} />
            <Route path="audit" element={<Suspense fallback={<RouteFallback />}><AuditSync /></Suspense>} />
            <Route path="oc" element={<Suspense fallback={<RouteFallback />}><OcTracking /></Suspense>} />
            <Route path="mining" element={<Suspense fallback={<RouteFallback />}><DataMining /></Suspense>} />
            <Route path="catalogo" element={<Suspense fallback={<RouteFallback />}><Catalog /></Suspense>} />
            <Route path="captura-rapida" element={<Suspense fallback={<RouteFallback />}><FastEntry /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ReloadPrompt />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/portal-maquilador" element={<Suspense fallback={<RouteFallback />}><MaquiladorPortal /></Suspense>} />
            <Route path="*" element={<Gate />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
