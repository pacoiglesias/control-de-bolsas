import { Modal, Empty } from '../ui';

interface CloudBackup {
  id: string;
  createdAt: Date | null;
  createdBy: string;
  totalOrders: number;
  [key: string]: any;
}

interface CloudBackupsModalProps {
  onClose: () => void;
  cloudBackups: CloudBackup[];
  backupBusy: boolean;
  handleCreateBackup: () => Promise<void>;
  handleRestoreBackup: (snap: CloudBackup) => Promise<void>;
}

export function CloudBackupsModal({ onClose, cloudBackups, backupBusy, handleCreateBackup, handleRestoreBackup }: CloudBackupsModalProps) {
  return (
    <Modal title="☁ Respaldos en la Nube (Máximo 5 rodantes)" onClose={onClose}>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
          El sistema mantiene automáticamente los <strong>5 respaldos más recientes</strong> en Firestore. Si creas uno nuevo, el más antiguo se elimina de la nube para no saturar.
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Respaldos activos: {cloudBackups.length} de 5</span>
          <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 12 }}>
            {backupBusy ? 'Guardando…' : '➕ Crear Nuevo Respaldo Ahora'}
          </button>
        </div>
        {cloudBackups.length === 0 ? (
          <Empty>No hay respaldos guardados aún en la nube.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cloudBackups.map((snap, idx) => (
              <div key={snap.id} style={{ padding: 14, background: 'var(--paper-sunk)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📅 {snap.createdAt ? snap.createdAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : snap.id}</span>
                    {idx === 0 && <span style={{ fontSize: 11, background: 'var(--ok)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>Más reciente</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                    Creado por: <strong>{snap.createdBy}</strong> · Expedientes: <strong>{snap.totalOrders}</strong>
                  </div>
                </div>
                <button className="btn" onClick={() => void handleRestoreBackup(snap)} disabled={backupBusy} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', fontSize: 12 }}>
                  🔄 Restaurar este respaldo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
