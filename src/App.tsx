import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { OrdersProvider } from './context/OrdersContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Cada pantalla se carga bajo demanda: antes las trece se importaban de forma
// estatica y viajaban todas en el chunk principal, Recharts incluido pese a
// que solo lo usa Dashboard. Con lazy() cada ruta va a su propio chunk y el
// navegador solo baja lo que la persona realmente visita.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Upload = lazy(() => import('./pages/Upload'));
const Orders = lazy(() => import('./pages/Orders'));
const Cobranza = lazy(() => import('./pages/Cobranza'));
const CajaChica = lazy(() => import('./pages/CajaChica'));
const Compras = lazy(() => import('./pages/Compras'));
const ControlCenter = lazy(() => import('./pages/ControlCenter'));
const Seeder = lazy(() => import('./pages/Seeder'));
const OcTracking = lazy(() => import('./pages/OcTracking'));
const Catalog = lazy(() => import('./pages/Catalog'));

function RouteFallback() {
  return (
    <div className="boot">
      <span className="spinner" /> Cargando…
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="boot">
        <span className="spinner" /> Verificando sesión…
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subir" element={<Upload />} />
        <Route path="ordenes" element={<Orders />} />
        <Route path="cobranza" element={<Cobranza />} />
        <Route path="caja-chica" element={<CajaChica />} />
        <Route path="compras" element={<Compras />} />
        <Route path="centro-control" element={<ControlCenter />} />
        <Route path="seed" element={<Seeder />} />
        <Route path="oc" element={<OcTracking />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          {/* OrdersProvider debe envolver a Gate: dentro viven las nueve
              pantallas que consumen useOrders(). */}
          <OrdersProvider>
            <Gate />
          </OrdersProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
