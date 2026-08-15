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
  onDownloadJson?: () => void;
}

export function CloudBackupsModal({ onClose, cloudBackups, backupBusy, handleCreateBackup, handleRestoreBackup, onDownloadJson }: CloudBackupsModalProps) {
  return (
    <Modal title="☁ Respaldos en la Nube y Copias de Seguridad" onClose={onClose}>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
          El sistema ejecuta <strong>respaldos automáticos cada medianoche</strong> y mantiene los snapshots más recientes en Firestore. También puedes crear un respaldo manual o descargar una copia física en archivo <code>.json</code>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Respaldos en la nube: {cloudBackups.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onDownloadJson && (
              <button className="btn" onClick={onDownloadJson} style={{ fontSize: 12, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                📥 Descargar Copia .JSON
              </button>
            )}
            <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 12 }}>
              {backupBusy ? 'Guardando…' : '➕ Crear Nuevo Respaldo Ahora'}
            </button>
          </div>
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
