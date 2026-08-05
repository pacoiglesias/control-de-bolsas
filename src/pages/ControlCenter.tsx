import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

// Importamos las vistas administrativas antiguas
import Settings from './Settings';
import Users from './Users';
import Respaldo from './Respaldo';
import Logs from './Logs';
import Papelera from './Papelera';

type Tab = 'settings' | 'users' | 'backup' | 'logs' | 'papelera';

export default function ControlCenter() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <div className="page-head">
        <h1>Centro de Control</h1>
        <p>Administración unificada del sistema, usuarios, respaldos y auditoría.</p>
      </div>

      <div className="tabs" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px' }}>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => setActiveTab('settings')}
          style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'settings' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'settings' ? 600 : 400, color: activeTab === 'settings' ? 'var(--brand)' : 'var(--text-light)' }}
        >
          ⚙️ Ajustes y Precios
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} 
          onClick={() => setActiveTab('users')}
          style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'users' ? 600 : 400, color: activeTab === 'users' ? 'var(--brand)' : 'var(--text-light)' }}
        >
          👥 Usuarios
        </button>
        <button 
          className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`} 
          onClick={() => setActiveTab('backup')}
          style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'backup' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'backup' ? 600 : 400, color: activeTab === 'backup' ? 'var(--brand)' : 'var(--text-light)' }}
        >
          💾 Respaldos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} 
          onClick={() => setActiveTab('logs')}
          style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'logs' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'logs' ? 600 : 400, color: activeTab === 'logs' ? 'var(--brand)' : 'var(--text-light)' }}
        >
          📝 Auditoría (Logs)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'papelera' ? 'active' : ''}`} 
          onClick={() => setActiveTab('papelera')}
          style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'papelera' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'papelera' ? 600 : 400, color: activeTab === 'papelera' ? 'var(--brand)' : 'var(--text-light)' }}
        >
          🗑️ Papelera
        </button>
      </div>

      <div className="tab-content" style={{ padding: '0 8px' }}>
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'users' && <Users />}
        {activeTab === 'backup' && <Respaldo />}
        {activeTab === 'logs' && <Logs />}
        {activeTab === 'papelera' && <Papelera />}
      </div>
    </>
  );
}
