import { lazy, Suspense, useEffect, type ReactNode } from 'react';
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
import { PrivacyProvider } from './context/PrivacyContext';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmDialogHost } from './lib/confirmDialog';
import { PromptDialogHost } from './lib/promptDialog';
import Layout from './components/Layout';
import Login from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';
import { llenarEspejoDeFacturas } from './lib/fillInvoicesMirror';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './lib/firebase';

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
const Users = lazy(() => import('./pages/Users'));

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
    <PrivacyProvider>
      <InvoicesProvider>
        <OrdersProvider>
          <PurchasesProvider>
            <ProductsProvider>
              <ExpensesProvider>
                <ToastProvider>
                  <UndoProvider>
                    <CommandPalette />
                    <ConfirmDialogHost />
                    <PromptDialogHost />
                    {children}
                  </UndoProvider>
                </ToastProvider>
              </ExpensesProvider>
            </ProductsProvider>
          </PurchasesProvider>
        </OrdersProvider>
      </InvoicesProvider>
    </PrivacyProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!user) return;
    const YA_CORRIO = 'cb_migracion_espejo_facturas_v1';
    // FIX 2026-08-09: la bandera "ya corrió" vivía solo en localStorage, es
    // decir, por navegador/dispositivo -- cualquier equipo nuevo, perfil
    // distinto o limpieza de caché volvía a disparar un recorrido completo
    // de TODOS los expedientes activos (lectura sin límite) más una
    // reescritura en lote de sus facturas, en cada primer login. Se mueve
    // la bandera a un documento en Firestore (compartido por todo el
    // sistema, no por dispositivo) para que la migración corra una sola
    // vez de verdad. Se conserva un caché local de solo-lectura para no
    // gastar ni siquiera esa 1 lectura de Firestore en cada login posterior
    // desde el mismo navegador.
    if (localStorage.getItem(YA_CORRIO)) return;

    const flagRef = doc(db, PATHS.config, 'migrations');
    (async () => {
      try {
        const snap = await getDoc(flagRef);
        if (snap.exists() && snap.data()?.espejoFacturasV1) {
          localStorage.setItem(YA_CORRIO, '1');
          return;
        }
        const { expedientes, facturas } = await llenarEspejoDeFacturas();
        console.log(`Espejo de facturas: ${facturas} facturas copiadas de ${expedientes} expedientes.`);
        localStorage.setItem(YA_CORRIO, '1');
        // Si el usuario no tiene permisos de escritura en /config (no es
        // Super Admin), esto puede fallar en silencio -- no es grave: la
        // migración en sí ya corrió y quedó guardada, solo no se pudo
        // marcar la bandera global. La próxima vez que un Super Admin
        // entre, la marcará.
        await setDoc(flagRef, { espejoFacturasV1: true, espejoFacturasV1At: serverTimestamp() }, { merge: true }).catch(() => {});
      } catch (e) {
        console.warn('No se pudo llenar el espejo de facturas:', e);
      }
    })();
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
  // Cada pantalla lleva su propio ErrorBoundary, ademas del global de mas
  // abajo (que sigue cubriendo Layout: nav, header, los avisos de
  // OverdueBanner/DeliveryDueBanner). Antes un error en cualquier pantalla
  // -- como el bug real de Seguimiento de Pedidos que se encontro esta
  // misma sesion -- tumbaba TODA la aplicacion a la pantalla "Algo salio
  // mal", incluyendo la barra lateral: no habia forma de navegar a otra
  // seccion sin recargar. Ahora solo se cae el contenido de esa pantalla;
  // el resto de la app sigue funcionando y se puede navegar a otro lado.
  const seccion = (el: ReactNode) => <ErrorBoundary><Suspense fallback={<RouteFallback />}>{el}</Suspense></ErrorBoundary>;
  return (
    <ErrorBoundary>
      <AppProviders>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={seccion(<Dashboard />)} />
            <Route path="ordenes" element={seccion(<Orders />)} />
            <Route path="cobranza" element={seccion(<Cobranza />)} />
            <Route path="caja-chica" element={seccion(<CajaChica />)} />
            <Route path="compras" element={seccion(<Compras />)} />
            <Route path="centro-control" element={seccion(<ControlCenter />)} />
            <Route path="audit" element={seccion(<AuditSync />)} />
            <Route path="oc" element={seccion(<OcTracking />)} />
            <Route path="mining" element={seccion(<DataMining />)} />
            <Route path="catalogo" element={seccion(<Catalog />)} />
            <Route path="captura-rapida" element={seccion(<FastEntry />)} />
            <Route path="usuarios" element={seccion(<Users />)} />
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
