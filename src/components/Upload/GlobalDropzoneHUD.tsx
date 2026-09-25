import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalDropInspectorModal } from './GlobalDropInspectorModal';

export function GlobalDropzoneHUD() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          setIsDraggingOver(true);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        setDroppedFile(files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(10, 15, 29, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: 640,
                border: '2.5px dashed #10b981',
                borderRadius: 28,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 78, 59, 0.15) 100%)',
                padding: '44px 32px',
                textAlign: 'center',
                boxShadow: '0 0 60px rgba(16, 185, 129, 0.25), inset 0 0 30px rgba(16, 185, 129, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'rgba(16, 185, 129, 0.18)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                }}
              >
                📥
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '-0.4px',
                  }}
                >
                  Suelta tu comprobante aquí
                </h2>
                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.75)',
                    lineHeight: 1.45,
                    maxWidth: 480,
                  }}
                >
                  El analizador inteligente extraerá folios, kilos e importes sin cometer errores y te pedirá confirmar antes de aplicar.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                {[
                  { icon: '🧾', label: 'Factura CFDI (PDF/XML)' },
                  { icon: '⚖️', label: 'Ticket de Báscula' },
                  { icon: '📋', label: 'Remisión de Patio' },
                  { icon: '📑', label: 'Contrarecibo Portal' },
                ].map((tag) => (
                  <span
                    key={tag.label}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '5px 12px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INSPECTOR Y PREVISUALIZADOR INTELIGENTE */}
      {droppedFile && (
        <GlobalDropInspectorModal
          file={droppedFile}
          onClose={() => setDroppedFile(null)}
        />
      )}
    </>
  );
}
