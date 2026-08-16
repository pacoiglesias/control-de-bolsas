import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { motion } from 'framer-motion';
import { Spinner } from './ui';

interface GenAIReaderProps {
  onDataExtracted: (data: any) => void;
  compact?: boolean;
}

export function GenAIReader({ onDataExtracted, compact = false }: GenAIReaderProps) {
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file) return;
    
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast('Formato no soportado. Usa PDF, JPG o PNG.', 'bad');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('El archivo es muy pesado. Máximo 5MB.', 'bad');
      return;
    }

    setIsProcessing(true);
    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
      });

      toast('Analizando con IA...', 'info');

      // Firebase AI Function en us-central1 (default)
      const aiFunctions = getFunctions(app, 'us-central1');
      const processDoc = httpsCallable(aiFunctions, 'parseDocumentData');
      const res = await processDoc({ base64, mimeType: file.type });
      
      toast('Documento leído con éxito 🪄', 'ok');
      onDataExtracted(res.data);
    } catch (err: any) {
      console.error(err);
      toast(`Error al leer documento: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
      // Reset input if needed
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`genai-dropzone ${isDragging ? 'dragging' : ''} ${compact ? 'compact' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? 'var(--info)' : 'var(--line)'}`,
        backgroundColor: isDragging ? 'var(--info-bg)' : 'var(--paper)',
        borderRadius: 'var(--radius)',
        padding: compact ? 16 : 32,
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
        marginBottom: 24,
      }}
      onClick={() => document.getElementById('genai-file-input')?.click()}
    >
      <input 
        id="genai-file-input"
        type="file" 
        accept="application/pdf, image/jpeg, image/png"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      {isProcessing ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spinner />
          <p style={{ margin: 0, color: 'var(--info)', fontWeight: 600 }}>La IA está leyendo el documento...</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: compact ? 24 : 32, marginBottom: 8 }}>🪄</div>
          <h3 style={{ margin: '0 0 4px 0', color: 'var(--ink)', fontSize: compact ? 14 : 16 }}>
            Lector Inteligente
          </h3>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13 }}>
            Arrastra tu Factura o Nota (PDF/Imagen) o haz clic para subir
          </p>
        </div>
      )}
    </motion.div>
  );
}
