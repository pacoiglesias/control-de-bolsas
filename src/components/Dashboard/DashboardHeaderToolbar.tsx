import { money, monthLabel } from '../../lib/format';
import { exportToExcel } from '../../lib/export';
import { downloadBackupJsonFile } from '../../lib/cloudBackup';
import type { NavigateFunction } from 'react-router-dom';
import type { PurchaseOrder } from '../../lib/types';

/**
 * FIX (v8.9.8, split de pages/Dashboard.tsx — ~1460 lineas): encabezado
 * principal consolidado (titulo, boton "Nuevo Expediente", dropdowns de
 * Reportes/Balanza y Exportar, barra de filtrado por departamento y mes)
 * extraido tal cual, sin cambiar logica. `shareRentabilidad`/
 * `printRentabilidad` se quedan definidas en el padre (dependen de `k`,
 * las estadisticas ya calculadas del Dashboard) y se reciben aqui listas.
 */
export function DashboardHeaderToolbar({
  nav,
  toast,
  deptFilter,
  setDeptFilter,
  monthFilter,
  setMonthFilter,
  deptPorCobrar,
  settings,
  mesesKeys,
  showReportsMenu,
  setShowReportsMenu,
  showExportMenu,
  setShowExportMenu,
  onOpenCorteMensual,
  onOpenCorteSemanal,
  onOpenBalanza,
  onOpenSincronizador,
  globalOrders,
  purchases,
  expenses,
  config,
  shareRentabilidad,
  printRentabilidad,
}: {
  nav: NavigateFunction;
  toast: (msg: string, tone?: 'info' | 'ok' | 'bad') => void;
  deptFilter: string;
  setDeptFilter: (d: string) => void;
  monthFilter: string;
  setMonthFilter: (m: string) => void;
  deptPorCobrar: { all: number; th: number; gt: number };
  settings: any;
  mesesKeys: string[];
  showReportsMenu: boolean;
  setShowReportsMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCorteMensual: () => void;
  onOpenCorteSemanal: () => void;
  onOpenBalanza: () => void;
  onOpenSincronizador: () => void;
  globalOrders: PurchaseOrder[];
  purchases: any;
  expenses: any;
  config: any;
  shareRentabilidad: () => void;
  printRentabilidad: () => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>Dashboard Maestro</h1>
            <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
              v{__APP_VERSION__} Enterprise
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
            Control Integral de Compra-Venta, Flujo de Efectivo, Cobranza y Suministro a Providencia.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* BOTÓN HERO: NUEVO EXPEDIENTE */}
          <button
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13.5,
              padding: '9px 18px',
              borderRadius: 12,
              boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
            onClick={() => nav('/ordenes?nueva=1')}
          >
            <span style={{ fontSize: 16 }}>➕</span>
            <span>Nuevo Expediente</span>
          </button>

          {/* DROPDOWN 1: REPORTES & BALANZA */}
          <div className="dropdown-container" style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowReportsMenu((prev) => !prev);
                setShowExportMenu(false);
              }}
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                fontWeight: 700,
                fontSize: 13,
                padding: '9px 14px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span>📑</span>
              <span>Reportes & Balanza</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{showReportsMenu ? '▲' : '▼'}</span>
            </button>

            {showReportsMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  zIndex: 100,
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  padding: 6,
                  minWidth: 240,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowReportsMenu(false); onOpenCorteMensual(); }}
                >
                  📑 Corte Mensual Contable
                </button>
                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowReportsMenu(false); onOpenCorteSemanal(); }}
                >
                  📅 Corte Semanal (Histórico)
                </button>
                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowReportsMenu(false); onOpenBalanza(); }}
                >
                  ⚖️ Balanza de Comprobación
                </button>
                <div style={{ height: 1, background: 'var(--line-soft)', margin: '2px 0' }} />
                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowReportsMenu(false); onOpenSincronizador(); }}
                >
                  ⚡ Sincronizar 10 Contrarecibos
                </button>
              </div>
            )}
          </div>

          {/* DROPDOWN 2: EXPORTAR & RESPALDO */}
          <div className="dropdown-container" style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu((prev) => !prev);
                setShowReportsMenu(false);
              }}
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                fontWeight: 700,
                fontSize: 13,
                padding: '9px 14px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span>📥</span>
              <span>Exportar</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{showExportMenu ? '▲' : '▼'}</span>
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  zIndex: 100,
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  padding: 6,
                  minWidth: 230,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={async () => {
                    setShowExportMenu(false);
                    toast('Generando sábana Excel con los datos actuales...', 'info');
                    try {
                      await exportToExcel();
                      toast('Sábana Excel descargada con éxito', 'ok');
                    } catch (e) {
                      toast(`Error al exportar: ${(e as Error).message}`, 'bad');
                    }
                  }}
                >
                  📊 Sábana Excel en Vivo
                </button>

                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => {
                    setShowExportMenu(false);
                    try {
                      downloadBackupJsonFile(globalOrders, purchases, expenses, config as any);
                      toast('💾 Respaldo descargado exitosamente en tu dispositivo.', 'ok');
                    } catch (e: any) {
                      toast(`Error al exportar: ${e.message}`, 'bad');
                    }
                  }}
                >
                  💾 Respaldo Local (1 Clic)
                </button>

                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowExportMenu(false); void shareRentabilidad(); }}
                >
                  📄 PDF Resumen de Rentabilidad
                </button>

                <button
                  className="btn"
                  style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                  onClick={() => { setShowExportMenu(false); printRentabilidad(); }}
                >
                  🖨️ Imprimir Reporte
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTRADO UNIFICADA CON MONTOS EN VIVO */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--paper-raised)',
          padding: '10px 16px',
          borderRadius: 16,
          border: '1px solid var(--line-soft)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDeptFilter('ALL')}
            style={{
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: deptFilter === 'ALL' ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: deptFilter === 'ALL' ? 'var(--accent-tint)' : 'var(--paper)',
              color: deptFilter === 'ALL' ? 'var(--accent-deep)' : 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🏢 Toda la Empresa</span>
            <span style={{
              background: deptFilter === 'ALL' ? 'var(--accent)' : 'var(--paper-sunk)',
              color: deptFilter === 'ALL' ? '#fff' : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 999,
            }}>
              {money(deptPorCobrar.all)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeptFilter('TH')}
            style={{
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: deptFilter === 'TH' ? '1px solid #0284c7' : '1px solid var(--line)',
              background: deptFilter === 'TH' ? '#e0f2fe' : 'var(--paper)',
              color: deptFilter === 'TH' ? '#0369a1' : 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={`${settings.deptNameTH || 'Textil Hogar'} — Responsable: ${settings.managerTH || 'Lic. Nava'}`}
          >
            <span>🔵 TH · {settings.managerTH || 'Nava'}</span>
            <span style={{
              background: deptFilter === 'TH' ? '#0284c7' : 'var(--paper-sunk)',
              color: deptFilter === 'TH' ? '#fff' : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 999,
            }}>
              {money(deptPorCobrar.th)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeptFilter('GT')}
            style={{
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: deptFilter === 'GT' ? '1px solid #16a34a' : '1px solid var(--line)',
              background: deptFilter === 'GT' ? '#dcfce7' : 'var(--paper)',
              color: deptFilter === 'GT' ? '#15803d' : 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={`${settings.deptNameGT || 'Grupo Textil'} — Responsable: ${settings.managerGT || 'Lic. Evelia'}`}
          >
            <span>🟢 GT · {settings.managerGT || 'Evelia'}</span>
            <span style={{
              background: deptFilter === 'GT' ? '#16a34a' : 'var(--paper-sunk)',
              color: deptFilter === 'GT' ? '#fff' : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 999,
            }}>
              {money(deptPorCobrar.gt)}
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            📅 Período P&L:
          </span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Histórico Global</option>
            {[...mesesKeys].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
