import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { OrdersProvider } from './context/OrdersContext';
import { PurchasesProvider } from './context/PurchasesContext';
import { ProductsProvider } from './context/ProductsContext';
import { ExpensesProvider } from './context/ExpensesContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';

// Cada pantalla se carga bajo demanda: antes las trece se importaban de forma
// estatica y viajaban todas en el chunk principal, Recharts incluido pese a
// que solo lo usa Dashboard. Con lazy() cada ruta va a su propio chunk y el
// navegador solo baja lo que la persona realmente visita.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Upload = lazy(() => import('./pages/Upload'));
const Orders = lazy(() => import('./pages/Orders'));
const Cobranza = lazy(() => import('./components/Cobranza'));
const CajaChica = lazy(() => import('./pages/CajaChica'));
const Compras = lazy(() => import('./pages/Compras'));
const ControlCenter = lazy(() => import('./pages/ControlCenter'));
const Seeder = lazy(() => import('./pages/Seeder'));
const OcTracking = lazy(() => import('./pages/OcTracking'));
const Catalog = lazy(() => import('./pages/Catalog'));
const FastEntry = lazy(() => import('./pages/FastEntry').then(m => ({ default: m.FastEntry })));
const FixData = lazy(() => import('./pages/FixData'));

function RouteFallback() {
  return (
    <div className="page" style={{ padding: 20 }}>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="skeleton-row" style={{ width: '40%', height: 32, marginBottom: 8 }}></div>
        <div className="skeleton-row" style={{ width: '60%', height: 16 }}></div>
      </div>
      <div className="kpi-grid">
        <div className="skeleton-card" style={{ height: 100 }}></div>
        <div className="skeleton-card" style={{ height: 100 }}></div>
        <div className="skeleton-card" style={{ height: 100 }}></div>
      </div>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
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
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
          <Route path="subir" element={<Suspense fallback={<RouteFallback />}><Upload /></Suspense>} />
          <Route path="ordenes" element={<Suspense fallback={<RouteFallback />}><Orders /></Suspense>} />
          <Route path="cobranza" element={<Suspense fallback={<RouteFallback />}><Cobranza /></Suspense>} />
          <Route path="caja-chica" element={<Suspense fallback={<RouteFallback />}><CajaChica /></Suspense>} />
          <Route path="compras" element={<Suspense fallback={<RouteFallback />}><Compras /></Suspense>} />
          <Route path="centro-control" element={<Suspense fallback={<RouteFallback />}><ControlCenter /></Suspense>} />
          <Route path="seed" element={<Suspense fallback={<RouteFallback />}><Seeder /></Suspense>} />
          <Route path="oc" element={<Suspense fallback={<RouteFallback />}><OcTracking /></Suspense>} />
          <Route path="catalogo" element={<Suspense fallback={<RouteFallback />}><Catalog /></Suspense>} />
          <Route path="captura-rapida" element={<Suspense fallback={<RouteFallback />}><FastEntry /></Suspense>} />
          <Route path="fix-data" element={<Suspense fallback={<RouteFallback />}><FixData /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ReloadPrompt />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrdersProvider>
          <PurchasesProvider>
            <ProductsProvider>
              <ExpensesProvider>
                <ToastProvider>
                  <Gate />
                </ToastProvider>
              </ExpensesProvider>
            </ProductsProvider>
          </PurchasesProvider>
        </OrdersProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
