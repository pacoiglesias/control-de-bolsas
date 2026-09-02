import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrdersContext } from '../context/OrdersContext';
import { useExpensesContext } from '../context/ExpensesContext';
import { useInvoicesContext } from '../context/InvoicesContext';
import { generateOfflineHTML } from '../lib/exportOfflineHTML';
import { triggerHaptic } from '../lib/hapticEngine';
import { useToast } from '../context/ToastContext';

// Importamos las vistas administrativas
import Settings from './Settings';
import Users from './Users';
import Respaldo from './Respaldo';
import Logs from './Logs';
import Papelera from './Papelera';

type Tab = 'settings' | 'users' | 'backup' | 'logs' | 'papelera';

export default function ControlCenter() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const { orders } = useOrdersContext();
  const { expenses } = useExpensesContext();
  const { invoices } = useInvoicesContext();
  const toast = useToast();

  const handleExportHTML = () => {
    triggerHaptic('light');
    const totalPorCobrar = invoices
      .filter((i) => i.creditCycle.status !== 'collected')
      .reduce((sum, i) => sum + (i.financials?.invoiceTotal || 0), 0);

    const snapshotData = {
      orders,
      expenses,
      kpis: {
        porCobrar: totalPorCobrar,
        cajaChica: 0,
        enTransito: 0,
      },
    };

    const htmlString = generateOfflineHTML(snapshotData);
    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERP-Offline-Snapshot-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    triggerHaptic('success');
    toast('🌐 ERP Portátil (.html) descargado con éxito', 'ok');
  };

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const tabsConfig = [
    { key: 'settings', label: '⚙️ Ajustes & Precios' },
    { key: 'users', label: '👥 Usuarios' },
    { key: 'backup', label: '💾 Respaldos' },
    { key: 'logs', label: '📝 Auditoría (Logs)' },
    { key: 'papelera', label: '🗑️ Papelera' },
  ] as const;

  return (
    <>
      <div
        className="page-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1>CENTRO DE CONTROL & GOBERNANZA</h1>
          <p>Administración unificada del sistema, usuarios, respaldos de base de datos y auditoría forense.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary"
          style={{ minHeight: 42, padding: '0 18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleExportHTML}
        >
          ⬇️ Exportar ERP Offline (.html)
        </motion.button>
      </div>

      {/* Selector de Pestañas Segmentadas */}
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 5,
          background: 'var(--paper-sunk, rgba(0, 0, 0, 0.25))',
          borderRadius: 14,
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          marginBottom: 24,
          flexWrap: 'wrap',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {tabsConfig.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.key);
              }}
              style={{
                background: isActive ? 'var(--accent, #3b82f6)' : 'transparent',
                color: isActive ? '#fff' : 'var(--ink-soft, #94a3b8)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.35)' : 'none',
              }}
            >
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          style={{ padding: '0 2px' }}
        >
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'users' && <Users />}
          {activeTab === 'backup' && <Respaldo />}
          {activeTab === 'logs' && <Logs />}
          {activeTab === 'papelera' && <Papelera />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

