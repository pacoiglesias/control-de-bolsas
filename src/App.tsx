import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Orders from './pages/Orders';
import Cobranza from './pages/Cobranza';
import Settings from './pages/Settings';
import Respaldo from './pages/Respaldo';
import CajaChica from './pages/CajaChica';
import Compras from './pages/Compras';
import Logs from './pages/Logs';

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
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subir" element={<Upload />} />
        <Route path="ordenes" element={<Orders />} />
        <Route path="cobranza" element={<Cobranza />} />
        <Route path="caja-chica" element={<CajaChica />} />
        <Route path="compras" element={<Compras />} />
        <Route path="configuracion" element={<Settings />} />
        <Route path="logs" element={<Logs />} />
        <Route path="respaldo" element={<Respaldo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
