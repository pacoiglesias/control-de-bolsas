import { useState, useEffect } from 'react';
import { OfflineExcelSyncModal } from '../Offline/OfflineExcelSyncModal';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="chip"
        onClick={() => setShowModal(true)}
        style={{
          background: isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${isOnline ? '#10b981' : '#ef4444'}`,
          color: isOnline ? '#047857' : '#b91c1c',
          fontWeight: 700,
          fontSize: 11.5,
          padding: '3px 9px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          cursor: 'pointer',
        }}
        title="Modo Offline & Sincronización Bidireccional con Excel (.xlsx)"
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isOnline ? '#10b981' : '#ef4444',
            display: 'inline-block',
            boxShadow: isOnline ? '0 0 6px #10b981' : '0 0 6px #ef4444',
          }}
        />
        <span>{isOnline ? 'En Línea' : 'Modo Offline'}</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>📲 Excel</span>
      </button>

      {showModal && <OfflineExcelSyncModal onClose={() => setShowModal(false)} />}
    </>
  );
}
