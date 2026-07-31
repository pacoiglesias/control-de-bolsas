import { useState, useMemo } from 'react';
import { useOrders } from '../hooks/useOrders';
import { Modal } from './ui';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useToast } from '../context/ToastContext';

interface Props {
  onClose: () => void;
}

export default function CierreMesModal({ onClose }: Props) {
  const { orders } = useOrders();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  
  // Meses únicos en las facturas
  const months = useMemo(() => {
    const m = new Set<string>();
    orders.forEach(o => {
      o.invoices?.forEach(inv => {
        if (inv.creditCycle?.dueDate) {
          const d = inv.creditCycle?.dueDate?.toDate?.() || new Date(inv.creditCycle?.dueDate as any);
          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          m.add(val);
        }
      });
    });
    return Array.from(m).sort().reverse(); // Mas recientes primero
  }, [orders]);

  const [selectedMonth, setSelectedMonth] = useState(months[0] || '');

  async function downloadZip() {
    if (!selectedMonth) return;
    setLoading(true);
    setProgress('Recopilando expedientes...');
    
    try {
      const storage = getStorage();
      const zip = new JSZip();
      let count = 0;
      
      const ordersInMonth = orders.filter(o => 
        o.invoices?.some(inv => {
          if (!inv.creditCycle?.dueDate) return false;
          const d = inv.creditCycle?.dueDate?.toDate?.() || new Date(inv.creditCycle?.dueDate as any);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        })
      );
      
      for (const o of ordersInMonth) {
        if (!o.fileName) continue; // Si no tiene archivo no hay nada que descargar
        
        try {
          setProgress(`Descargando ${o.folio || o.id}...`);
          // En upload prefix se guardaron (tanto PDF como XML ahora)
          const fileRef = ref(storage, o.fileName);
          const url = await getDownloadURL(fileRef);
          
          const response = await fetch(url);
          const blob = await response.blob();
          
          // Extraer nombre original de la URL o usar el ID
          let originalName = o.fileName.split('/').pop() || `${o.folio || o.id}.pdf`;
          
          // Eliminar el timestamp prefix (e.g. 1700000000000-Factura.pdf)
          const match = originalName.match(/^\d+-(.+)$/);
          if (match) originalName = match[1];
          
          zip.file(originalName, blob);
          count++;
          
        } catch (e) {
          console.error("Error downloading", o.fileName, e);
        }
      }
      
      if (count === 0) {
        toast('No se encontraron archivos en Storage para este mes.', 'bad');
        setLoading(false);
        return;
      }
      
      setProgress('Comprimiendo ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `CierreContable_Providencia_${selectedMonth}.zip`);
      toast(`ZIP exportado con ${count} archivos.`, 'ok');
      onClose();
      
    } catch (e: any) {
      toast('Error al exportar ZIP: ' + e.message, 'bad');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  return (
    <Modal title="Cierre de Mes Contable" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>Selecciona un mes para descargar en un archivo ZIP todos los PDFs y XMLs validados por el sistema (que fueron subidos a la bandeja).</p>
        
        <div>
          <label className="label">Mes de Cierre</label>
          <select 
            className="input" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            disabled={loading}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        
        {loading && (
          <div style={{ padding: 12, background: 'var(--bg-faint)', borderRadius: 4, color: 'var(--accent)' }}>
            <span className="spinner sm" /> {progress}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={downloadZip} disabled={loading || !selectedMonth}>
            {loading ? 'Generando...' : 'Descargar ZIP'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
