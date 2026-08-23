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
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!(await confirmDialog(`⚠️ ¿Confirmas restaurar el archivo "${file.name}" hacia Firestore?\n\nSe actualizarán las órdenes y registros contables amparados en este respaldo.`))) {
      return;
    }

    setUploading(true);
    try {
      const res = await restoreBackupFromJsonFile(file, user?.email);
      sound.playChaChing();
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
      toast(`✅ ${res.message}`, 'ok');
      onClose();
    } catch (err: any) {
      sound.playError();
      toast(`Error al restaurar: ${err.message}`, 'bad');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal title="🛡️ Centro de Salud & Respaldos de Seguridad" onClose={onClose}>
      <div style={{ padding: 16 }}>
        {/* Banner de Estado de Salud */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🟢</span> Base de Datos Conectada & Saludable
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              Respaldo automático cada medianoche · Rotación de las últimas 5 copias en Firestore.
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', background: 'var(--paper)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>
            📦 {cloudBackups.length} de 5 Respaldos Guardados
          </div>
        </div>

        {/* Input Oculto para Subir Archivo JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          }}
          accept=".json,application/json"
          style={{ display: 'none' }}
        />

        {/* Zona de Arrastrar o Botones de Acción */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
          }}
          style={{
            border: isDragging ? '2px dashed #3b82f6' : '1px solid var(--line)',
            background: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'var(--paper-sunk)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            transition: 'all 0.2s',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
              {isDragging ? '📥 Suelta el archivo .json aquí' : '⚙️ Acciones de Respaldo & Restauración'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Crea un snapshot en la nube, sube un archivo físico o descarga una copia local.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || backupBusy}
              style={{
                fontSize: 12,
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                padding: '8px 14px',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
              title="Selecciona un archivo .json de tu computadora para restaurar"
            >
              {uploading ? '⏳ Restaurando…' : '📤 Subir / Restaurar .JSON'}
            </button>

            {onDownloadJson && (
              <button
                className="btn"
                onClick={onDownloadJson}
                style={{
                  fontSize: 12,
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: 10,
                }}
                title="Descargar copia física en archivo .json"
              >
                📥 Descargar Copia .JSON
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={() => void handleCreateBackup()}
              disabled={backupBusy || uploading}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '8px 14px',
                borderRadius: 10,
              }}
            >
              {backupBusy ? 'Guardando…' : '☁ Crear Respaldo en la Nube'}
            </button>
          </div>
        </div>

        {/* Lista de Respaldos Históricos en la Nube */}
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📜</span> Historial de Copias de Seguridad en Firestore ({cloudBackups.length})
        </div>

        {cloudBackups.length === 0 ? (
          <Empty>No hay respaldos guardados aún en la nube.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cloudBackups.map((snap, idx) => (
              <div
                key={snap.id}
                style={{
                  padding: '14px 18px',
                  background: 'var(--paper-sunk)',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📅 {snap.createdAt ? snap.createdAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : snap.id}</span>
                    {idx === 0 && (
                      <span style={{ fontSize: 10, fontWeight: 900, background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                        MÁS RECIENTE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                    Creado por: <strong>{snap.createdBy || 'Sistema Automático'}</strong> · Expedientes amparados: <strong>{snap.totalOrders ?? 0}</strong>
                  </div>
                </div>

                <button
                  className="btn"
                  onClick={() => void handleRestoreBackup(snap)}
                  disabled={backupBusy || uploading}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '6px 12px',
                    borderRadius: 8,
                  }}
                >
                  🔄 Restaurar este Respaldo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
