/**
 * DocumentsArchive.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla de Archivo de Documentos Originales.
 * Muestra todos los PDFs/XMLs subidos al sistema, con filtros por tipo,
 * acciones de descarga, visualización, edición y eliminación.
 * Incluye dropzone directo y selección de archivos con touch targets ≥ 44px.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  listStoredDocuments,
  deleteStoredDocument,
  updateStoredDocument,
  formatFileSize,
  docKindIcon,
  docKindLabel,
  type StoredDocument,
  type StoredDocKind,
} from '../../lib/documentStorage';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { GlobalDropInspectorModal } from './GlobalDropInspectorModal';

const KIND_FILTERS: { value: StoredDocKind | 'all'; label: string; icon: string }[] = [
  { value: 'all',              label: 'Todos',            icon: '📁' },
  { value: 'oc_providencia',   label: 'Órdenes de Compra', icon: '📋' },
  { value: 'factura_cfdi',     label: 'Facturas CFDI',    icon: '🧾' },
  { value: 'pago_providencia', label: 'Pagos TR',         icon: '💵' },
  { value: 'ticket_bascula',   label: 'Tickets Báscula',  icon: '⚖️' },
  { value: 'contrarecibo',     label: 'Contrarecibos',    icon: '📑' },
  { value: 'remision',         label: 'Remisiones',       icon: '🚚' },
];

export function DocumentsArchive() {
  const toast = useToast();

  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<StoredDocKind | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editFolio, setEditFolio] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal para procesar nuevo archivo subido directamente desde esta pantalla
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOverDirect, setIsDragOverDirect] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listStoredDocuments(
        filterKind !== 'all' ? { docKind: filterKind } : undefined,
      );
      setDocs(all);
    } catch (err) {
      console.error(err);
      toast('Error al cargar el archivo de documentos', 'bad');
    } finally {
      setLoading(false);
    }
  }, [filterKind, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (d: StoredDocument) => {
    triggerHaptic('warning');
    if (!window.confirm(`¿Eliminar permanentemente "${d.fileName}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(d.id);
    try {
      await deleteStoredDocument(d);
      triggerHaptic('success');
      toast(`Documento "${d.fileName}" eliminado`, 'ok');
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err: any) {
      triggerHaptic('error');
      toast(`Error al eliminar: ${err.message}`, 'bad');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async (d: StoredDocument) => {
    triggerHaptic('light');
    try {
      await updateStoredDocument(d.id, { folio: editFolio, notes: editNotes });
      triggerHaptic('success');
      setDocs((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, folio: editFolio, notes: editNotes } : x))
      );
      toast('Documento actualizado', 'ok');
      setEditingId(null);
    } catch (err: any) {
      triggerHaptic('error');
      toast(`Error al guardar: ${err.message}`, 'bad');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic('light');
      setSelectedFile(file);
      e.target.value = '';
    }
  };

  const handleDirectDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDirect(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      triggerHaptic('light');
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const filtered = docs.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.fileName.toLowerCase().includes(q) ||
      d.folio.toLowerCase().includes(q) ||
      (d.ocNumber || '').toLowerCase().includes(q) ||
      (d.orderFolio || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* INPUT OCULTO PARA SUBIDA DIRECTA */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xml,image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* HEADER & ACCIONES */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 32 }}>🗂️</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>
            Archivo de Documentos Originales
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {docs.length} documento{docs.length !== 1 ? 's' : ''} · PDFs, XMLs y comprobantes guardados automáticamente al procesar
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              triggerHaptic('light');
              fileInputRef.current?.click();
            }}
            style={{
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
          >
            <span>📤</span>
            <span>Subir y Procesar Documento</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              load();
            }}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: '0 16px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--paper-raised)',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>🔄</span>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ZONA DE ARRASTRE DIRECTA */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverDirect(true);
        }}
        onDragLeave={() => setIsDragOverDirect(false)}
        onDrop={handleDirectDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragOverDirect ? '2px dashed #2563eb' : '2px dashed var(--line)',
          background: isDragOverDirect ? 'rgba(37, 99, 235, 0.08)' : 'var(--paper-sunk)',
          borderRadius: 14,
          padding: '24px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📑</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
          Arrastra un PDF, XML o imagen aquí para procesar y archivar
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
          Extracción automática de Kilos, Folios e Importes · Archivo original respaldado en Firebase Storage
        </div>
      </div>

      {/* FILTROS DE TIPO */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {KIND_FILTERS.map((f) => {
          const count = f.value === 'all' ? docs.length : docs.filter((x) => x.docKind === f.value).length;
          const isSelected = filterKind === f.value;
          return (
            <button
              key={f.value}
              onClick={() => {
                triggerHaptic('light');
                setFilterKind(f.value as any);
              }}
              style={{
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 10,
                border: isSelected ? '1.5px solid #10b981' : '1px solid var(--line)',
                background: isSelected ? 'rgba(16,185,129,0.12)' : 'var(--paper-raised)',
                color: isSelected ? '#10b981' : 'var(--ink-soft)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: isSelected ? 'rgba(16,185,129,0.25)' : 'var(--paper-sunk)',
                  color: isSelected ? '#10b981' : 'var(--ink-faint)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* BUSCADOR */}
      <input
        type="text"
        placeholder="🔍 Buscar por nombre de archivo, folio, OC, notas o fecha..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          fontSize: 13,
          fontWeight: 600,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {/* TABLA DE DOCUMENTOS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-soft)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32 }} />
          Cargando documentos archivados...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            border: '2px dashed var(--line)',
            borderRadius: 16,
            color: 'var(--ink-faint)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
            {searchQuery ? 'Sin resultados para la búsqueda' : 'Aún no hay documentos guardados en esta categoría'}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-soft)' }}>
            Cuando subas un PDF u OC y lo confirmes, el archivo original se guardará aquí automáticamente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((d) => (
            <div
              key={d.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: 'var(--paper-raised)',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {editingId === d.id ? (
                /* ── MODO EDICIÓN ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 13 }}>
                    ✏️ Editando Documento: {d.fileName}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--ink-soft)',
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Folio / Referencia Oficial
                      </label>
                      <input
                        type="text"
                        value={editFolio}
                        onChange={(e) => setEditFolio(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                          fontWeight: 700,
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--ink-soft)',
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Notas y Observaciones
                      </label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                          fontSize: 12,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        minHeight: 44,
                        padding: '0 16px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--paper)',
                        color: 'var(--ink-soft)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveEdit(d)}
                      style={{
                        minHeight: 44,
                        padding: '0 18px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      💾 Guardar Cambios
                    </button>
                  </div>
                </div>
              ) : (
                /* ── MODO VISTA ── */
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {/* Ícono de tipo */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'var(--paper-sunk)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {docKindIcon(d.docKind)}
                  </div>

                  {/* Detalle del documento */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 14 }}>
                        {d.folio || d.fileName}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'var(--paper-sunk)',
                          color: 'var(--ink-soft)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                        }}
                      >
                        {docKindLabel(d.docKind)}
                      </span>
                      {d.orderFolio && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#2563eb',
                            fontWeight: 800,
                            padding: '2px 8px',
                            background: 'rgba(37, 99, 235, 0.1)',
                            borderRadius: 6,
                          }}
                        >
                          OC: {d.orderFolio}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-soft)',
                        marginTop: 4,
                        display: 'flex',
                        gap: 14,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>📅 {d.docDate || 'Sin fecha'}</span>
                      {d.kilos > 0 && (
                        <span style={{ fontWeight: 800, color: '#10b981' }}>
                          ⚖️ {d.kilos.toLocaleString('es-MX')} kg
                        </span>
                      )}
                      {d.total > 0 && (
                        <span style={{ fontWeight: 800, color: 'var(--ink)' }}>
                          💲 {money(d.total)}
                        </span>
                      )}
                      <span style={{ color: 'var(--ink-faint)' }}>
                        {formatFileSize(d.sizeBytes)} · {d.fileName}
                      </span>
                    </div>

                    {d.notes && (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, fontStyle: 'italic' }}>
                        Nota: {d.notes}
                      </div>
                    )}
                  </div>

                  {/* Acciones con touch target ≥ 44px */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {/* Ver / Descargar */}
                    <a
                      href={d.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver / Descargar documento original"
                      style={{
                        minHeight: 44,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--paper)',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 12,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>👁️</span>
                      <span>Ver Original</span>
                    </a>

                    {/* Editar */}
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setEditingId(d.id);
                        setEditFolio(d.folio);
                        setEditNotes(d.notes || '');
                      }}
                      title="Editar folio y notas"
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        padding: '0 12px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--paper)',
                        color: 'var(--ink-soft)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✏️
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      title="Eliminar documento permanentemente"
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        padding: '0 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.06)',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {deletingId === d.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE PROCESAMIENTO INTELIGENTE CUANDO SE SELECCIONA UN ARCHIVO */}
      {selectedFile && (
        <GlobalDropInspectorModal
          file={selectedFile}
          onClose={() => {
            setSelectedFile(null);
            load();
          }}
        />
      )}
    </div>
  );
}
