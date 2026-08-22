import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { IconClipboardList, IconClock, IconCoins, IconCheckCircle, IconFileText, IconScale } from '../ui/icons';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): barra de tabs con
 * contadores extraída tal cual, sin cambiar lógica.
 */
export default function CobranzaTabsNav() {
  const { activeTab, setActiveTab, data } = useContext(CobranzaContext)!;

  return (
    <div className="tabs" style={{ marginBottom: 20, marginTop: 20 }}>
      <button className={`tab ${activeTab === 'tablero' ? 'active' : ''}`} onClick={() => setActiveTab('tablero')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconClipboardList size={16} /> Tablero (Kanban)
      </button>
      <button className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconClock size={16} /> Pendientes de Cobro ({data.open.length})
      </button>
      <button className={`tab ${activeTab === 'pagadas' ? 'active' : ''}`} onClick={() => setActiveTab('pagadas')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconCoins size={16} /> Por Recoger Efectivo ({data.paid.length})
      </button>
      <button className={`tab ${activeTab === 'recogidas' ? 'active' : ''}`} onClick={() => setActiveTab('recogidas')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconCheckCircle size={16} /> Historial: Recogidos ({data.collected.length})
      </button>
      <button className={`tab ${activeTab === 'contabilidad' ? 'active' : ''}`} onClick={() => setActiveTab('contabilidad')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconFileText size={16} /> Liquidación a Contabilidad
      </button>
      <button className={`tab ${activeTab === 'estado_cuenta' ? 'active' : ''}`} onClick={() => setActiveTab('estado_cuenta')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconScale size={16} /> Estado de Cuenta (Espejo)
      </button>
    </div>
  );
}
