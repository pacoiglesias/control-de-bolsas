import { DocumentsArchive } from '../components/Upload/DocumentsArchive';

export default function DocumentsArchivePage() {
  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Archivo de Documentos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
            PDFs y comprobantes originales guardados automáticamente al procesar cada documento
          </p>
        </div>
      </div>
      <DocumentsArchive />
    </div>
  );
}
