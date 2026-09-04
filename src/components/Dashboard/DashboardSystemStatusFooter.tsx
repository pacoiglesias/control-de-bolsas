import { fmtDate } from '../../lib/format';
import { SYSTEM_CHANGELOG } from '../../lib/systemChangelog';
import type { LiveLogEntry } from '../../pages/Dashboard';

/**
 * FIX (v8.9.8, split de pages/Dashboard.tsx — ~1460 lineas): suite de 3
 * tarjetas de monitoreo del sistema (Último Movimiento, Versión del ERP,
 * Salud & Respaldos) extraida tal cual como componente presentacional,
 * sin cambiar logica. Los botones siguen disparando callbacks controlados
 * por el padre (abrir modales, crear/listar respaldos, recalcular).
 */
export function DashboardSystemStatusFooter({
  role,
  liveLogs,
  onOpenLiveLogs,
  onOpenChangelog,
  health,
  backupBusy,
  recalcBusy,
  onCreateBackup,
  onOpenBackupsModal,
  onRecalc,
}: {
  role: string | null | undefined;
  liveLogs: LiveLogEntry[];
  onOpenLiveLogs: () => void;
  onOpenChangelog: () => void;
  health: { snapshotDate: Date | null; recentLogs: number; dbStatus: string };
  backupBusy: boolean;
  recalcBusy: boolean;
  onCreateBackup: () => void;
  onOpenBackupsModal: () => void;
  onRecalc: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 32, marginBottom: 32 }}>
      {role === 'admin' && (
        <div
          style={{
            padding: 16,
            background: 'var(--paper-raised)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'var(--ok-bg)',
              color: 'var(--ok)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Último Movimiento</span>
              <span className="live-status-pill" style={{ fontSize: 10, padding: '2px 6px' }}>● En vivo</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700, marginTop: 2 }}>
              🕒 {liveLogs[0]?.timestamp ? liveLogs[0].timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Esperando movimiento…'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {liveLogs[0]?.action || 'Sistema iniciado'}
            </div>
            <button className="btn btn-primary" onClick={onOpenLiveLogs} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
              ⚡ Ver Monitor de Eventos
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          padding: 16,
          background: 'var(--paper-raised)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--line-soft)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: 'var(--accent-sunk)',
            color: 'var(--accent-deep)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          🚀
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Versión del ERP</span>
            <span className="badge" style={{ background: 'var(--ok)', fontSize: 10 }}>v{__APP_VERSION__}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-deep)', fontWeight: 600, marginTop: 2 }}>
            📅 {SYSTEM_CHANGELOG[0]?.date ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {SYSTEM_CHANGELOG[0]?.summary ?? ''}
          </div>
          <button className="btn" onClick={onOpenChangelog} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
            📜 Bitácora de Versiones
          </button>
        </div>
      </div>

      {role === 'admin' && (
        <div
          style={{
            padding: 16,
            background: 'var(--paper-raised)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'var(--info-bg)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🛡️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>Salud & Respaldos</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, marginBottom: 4 }}>
              BD: <strong>{health.dbStatus}</strong> · Respaldo: {health.snapshotDate ? fmtDate(health.snapshotDate) : 'No detectado'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={onCreateBackup} disabled={backupBusy} style={{ fontSize: 11, padding: '4px 9px', fontWeight: 700 }}>
                {backupBusy ? 'Guardando…' : '☁ Crear Respaldo'}
              </button>
              <button className="btn" onClick={onOpenBackupsModal} disabled={backupBusy} style={{ fontSize: 11, padding: '4px 9px', fontWeight: 600, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                📁 Ver & Subir Respaldos
              </button>
              <button className="btn" onClick={onRecalc} disabled={recalcBusy} style={{ fontSize: 11, padding: '4px 9px', fontWeight: 600 }}>
                {recalcBusy ? '⏳ Recalculando…' : '🔄 Recalcular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
