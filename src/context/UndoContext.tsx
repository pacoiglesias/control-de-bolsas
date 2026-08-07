import React, { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

interface UndoAction {
  id: string;
  message: string;
  undo: () => Promise<void>;
}

interface UndoContextType {
  executeWithUndo: (
    execute: () => Promise<void> | void,
    undo: () => Promise<void>,
    message: string,
    timeoutMs?: number
  ) => Promise<void>;
}

const UndoContext = createContext<UndoContextType | null>(null);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [activeUndo, setActiveUndo] = useState<UndoAction | null>(null);
  const toast = useToast();

  const executeWithUndo = useCallback(async (
    execute: () => Promise<void> | void,
    undo: () => Promise<void>,
    message: string,
    timeoutMs = 10000
  ) => {
    // 1. Ejecutar la acción optimísticamente
    try {
      await execute();
    } catch (err: any) {
      toast(`Error al ejecutar: ${err.message}`, 'bad');
      return;
    }

    // 2. Registrar la acción deshacer
    const actionId = Math.random().toString(36).substring(7);
    const newUndo: UndoAction = {
      id: actionId,
      message,
      undo
    };
    
    setActiveUndo(newUndo);

    // 3. Auto-limpiar después del timeout
    setTimeout(() => {
      setActiveUndo(current => {
        if (current?.id === actionId) return null;
        return current;
      });
    }, timeoutMs);

  }, [toast]);

  const handleUndo = async () => {
    if (!activeUndo) return;
    const { undo, message } = activeUndo;
    setActiveUndo(null); // Quitar el toast de inmediato
    
    try {
      await undo();
      toast(`Deshacer exitoso: ${message}`, 'ok');
    } catch (err: any) {
      toast(`No se pudo deshacer: ${err.message}`, 'bad');
    }
  };

  return (
    <UndoContext.Provider value={{ executeWithUndo }}>
      {children}
      
      {/* Toast Flotante de Deshacer */}
      <AnimatePresence>
        {activeUndo && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              marginLeft: '-150px', // Center trick if transform is weird with framer motion
              transform: 'translateX(0)', // framer motion handles this better without -50%
              background: 'var(--ink)',
              color: 'var(--paper)',
              padding: '12px 20px',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
              zIndex: 9999,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>{activeUndo.message}</span>
            <button
              onClick={handleUndo}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'inherit',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              Deshacer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo debe usarse dentro de UndoProvider');
  return ctx;
}
