import { useState, useRef } from 'react';
import { Modal, Empty } from '../ui';
import { restoreBackupFromJsonFile } from '../../lib/cloudBackup';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import { confirmDialog } from '../../lib/confirmDialog';

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
  const toast = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(await confirmDialog(`¿Confirmas restaurar el archivo "${file.name}" hacia la base de datos de Firestore? Se actualizarán las órdenes y movimientos amparados en este respaldo.`))) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const res = await restoreBackupFromJsonFile(file, user?.email);
      sound.playChaChing();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast(`✅ ${res.message}`, 'ok');
      onClose();
    } catch (err: any) {
      sound.playError();
      toast(`Error al restaurar: ${err.message}`, 'bad');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Modal title="☁ Respaldos en la Nube y Copias de Seguridad" onClose={onClose}>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
          El sistema ejecuta <strong>respaldos automáticos cada medianoche</strong> y mantiene los snapshots más recientes en Firestore. También puedes crear un respaldo manual o subir/descargar una copia física en archivo <code>.json</code>.
        </p>

        {/* Input Oculto para Subir Archivo JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".json,application/json"
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Respaldos en la nube: {cloudBackups.length}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || backupBusy}
              style={{ fontSize: 12, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', border: 'none', fontWeight: 700 }}
              title="Selecciona un archivo .json de tu computadora para restaurar"
            >
              {uploading ? '⏳ Restaurando…' : '📤 Subir Archivo .JSON'}
            </button>
            {onDownloadJson && (
              <button className="btn" onClick={onDownloadJson} style={{ fontSize: 12, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                📥 Descargar .JSON
              </button>
            )}
            <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy || uploading} style={{ fontSize: 12 }}>
              {backupBusy ? 'Guardando…' : '➕ Crear Respaldo Ahora'}
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
                <button className="btn" onClick={() => void handleRestoreBackup(snap)} disabled={backupBusy || uploading} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', fontSize: 12 }}>
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
