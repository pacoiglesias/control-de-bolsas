import React, { useState } from 'react';
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { toast } from 'react-hot-toast';

export default function AuditSync() {
  const [file, setFile] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'cobranza' | 'compras' | 'caja'>('cobranza');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        await processDiffs(workbook, XLSX);
      };
      reader.readAsArrayBuffer(uploadedFile);
    } catch (err) {
      console.error(err);
      toast.error('Error al leer el archivo');
      setIsProcessing(false);
    }
  };

  const processDiffs = async (workbook: any, XLSX: any) => {
    const newDiffs = [];

    // 1. Cobranza
    const cobranzaSheet = workbook.Sheets['Auditoria_Cobranza'];
    if (cobranzaSheet) {
      const cobranzaRows = XLSX.utils.sheet_to_json(cobranzaSheet);
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const orderDocs = ordersSnap.docs.map(d => ({ id: d.id, data: d.data() }));

      for (const row of cobranzaRows as any[]) {
        if (!row.ID_SISTEMA) {
          // New
          newDiffs.push({ tab: 'cobranza', type: 'new', label: `Factura ${row.FacturaFolio || 'Sin Folio'}`, newValue: row.MontoVenta, rawData: row });
          continue;
        }

        const [orderId, invoiceId] = row.ID_SISTEMA.split('::');
        const order = orderDocs.find(o => o.id === orderId);
        if (order) {
          const inv = order.data.invoices?.find((i: any) => i.id === invoiceId);
          if (inv) {
            const sysTotal = inv.financials?.invoiceTotal || 0;
            const excelTotal = Number(row.MontoVenta) || 0;
            if (Math.abs(sysTotal - excelTotal) > 0.01) {
              newDiffs.push({
                tab: 'cobranza',
                type: 'mod',
                id: row.ID_SISTEMA,
                label: `Factura ${inv.folio}`,
                oldValue: sysTotal,
                newValue: excelTotal
              });
            }
            
            const sysStatus = inv.creditCycle?.status || '';
            const excelStatus = row.Estatus || '';
            if (sysStatus !== excelStatus) {
                newDiffs.push({
                    tab: 'cobranza',
                    type: 'mod',
                    id: row.ID_SISTEMA,
                    label: `Estatus Factura ${inv.folio}`,
                    oldValue: sysStatus,
                    newValue: excelStatus
                });
            }
          }
        }
      }
    }

    // 2. Caja Chica
    const cajaSheet = workbook.Sheets['Auditoria_CajaChica'];
    if (cajaSheet) {
      const cajaRows = XLSX.utils.sheet_to_json(cajaSheet);
      const expensesSnap = await getDocs(collection(db, PATHS.expenses));
      const expenseDocs = expensesSnap.docs.map(d => ({ id: d.id, data: d.data() }));

      for (const row of cajaRows as any[]) {
        if (!row.ID_SISTEMA) {
          newDiffs.push({ tab: 'caja', type: 'new', label: `Movimiento: ${row.Concepto}`, newValue: row.Monto, rawData: row });
          continue;
        }

        const exp = expenseDocs.find(e => e.id === row.ID_SISTEMA);
        if (exp) {
          const sysTotal = exp.data.amount || 0;
          const excelTotal = Number(row.Monto) || 0;
          if (Math.abs(sysTotal - excelTotal) > 0.01) {
            newDiffs.push({
              tab: 'caja',
              type: 'mod',
              id: row.ID_SISTEMA,
              label: `Movimiento: ${exp.data.concept}`,
              oldValue: sysTotal,
              newValue: excelTotal
            });
          }
        }
      }
    }

    setDiffs(newDiffs);
    setIsProcessing(false);
  };

  const applyChanges = async () => {
    if (!confirm('¿Estás seguro de aplicar estos ajustes al sistema? Esta acción es irreversible.')) return;
    
    setIsProcessing(true);
    
    try {
      await runTransaction(db, async (tx) => {
        // First, prepare all references to read for 'mod' updates
        const orderRefsToRead = new Set<string>();
        const expRefsToRead = new Set<string>();
        
        for (const diff of diffs) {
            if (diff.type === 'mod') {
                if (diff.tab === 'cobranza') orderRefsToRead.add(diff.id.split('::')[0]);
                if (diff.tab === 'caja') expRefsToRead.add(diff.id);
            }
        }
        
        // Batch read to ensure consistency in the transaction
        const orderSnaps = new Map();
        for (const orderId of Array.from(orderRefsToRead)) {
            const ref = doc(db, PATHS.orders, orderId);
            orderSnaps.set(orderId, await tx.get(ref));
        }
        
        // Execute writes (updates and creations)
        for (const diff of diffs) {
            if (diff.tab === 'cobranza') {
                if (diff.type === 'mod') {
                    const [orderId, invoiceId] = diff.id.split('::');
                    const snap = orderSnaps.get(orderId);
                    if (snap && snap.exists()) {
                        const orderData = snap.data();
                        const updatedInvoices = orderData.invoices.map((inv: any) => {
                            if (inv.id === invoiceId) {
                                if (diff.label.includes('Estatus')) {
                                    return { ...inv, creditCycle: { ...inv.creditCycle, status: diff.newValue } };
                                } else {
                                    return { ...inv, financials: { ...inv.financials, invoiceTotal: diff.newValue } };
                                }
                            }
                            return inv;
                        });
                        tx.update(snap.ref, { invoices: updatedInvoices });
                    }
                } else if (diff.type === 'new') {
                    // Create a new order with a placeholder invoice
                    const newOrderRef = doc(collection(db, PATHS.orders));
                    tx.set(newOrderRef, {
                        folio: diff.rawData.FacturaFolio || 'NUEVA',
                        client: diff.rawData.Cliente || 'SIN CLIENTE',
                        createdAt: Date.now(),
                        invoices: [{
                            id: newOrderRef.id + '-inv0',
                            folio: diff.rawData.FacturaFolio || 'NUEVA',
                            kilos: 0,
                            financials: { invoiceTotal: Number(diff.newValue) || 0, saleTotal: 0 },
                            creditCycle: { status: diff.rawData.Estatus || 'pedido' },
                            collection: {}
                        }]
                    });
                }
            } else if (diff.tab === 'caja') {
                if (diff.type === 'mod') {
                    const expRef = doc(db, PATHS.expenses, diff.id);
                    tx.update(expRef, { amount: Number(diff.newValue) });
                } else if (diff.type === 'new') {
                    const newExpRef = doc(collection(db, PATHS.expenses));
                    tx.set(newExpRef, {
                        amount: Number(diff.newValue) || 0,
                        concept: diff.rawData.Concepto || 'Ajuste Auditoría',
                        provider: 'Andrés', // Defaulting to main provider for Caja Chica
                        type: Number(diff.newValue) < 0 ? 'ingreso' : 'egreso',
                        date: Date.now()
                    });
                }
            }
        }
      });
      
      toast.success('Ajustes aplicados correctamente mediante Transacción Segura');
      setDiffs([]);
      setFile(null);
    } catch (e) {
      console.error(e);
      toast.error('Error al aplicar cambios');
    }
    
    setIsProcessing(false);
  };

  const filteredDiffs = diffs.filter(d => d.tab === activeTab);

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto', background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: '2rem' }}>
      <h1 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>⚖️</span> Auditoría Maestra por Excel
      </h1>
      
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Sube tu Sábana de Auditoría modificada. El sistema detectará los cambios y te propondrá los ajustes antes de guardarlos en la base de datos.
      </p>

      {!file && (
        <div style={{ border: '2px dashed #ccc', padding: '3rem', textAlign: 'center', borderRadius: 8 }}>
          <label style={{ background: 'var(--brand)', color: '#fff', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            Subir Sábana Modificada
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>
      )}

      {isProcessing && <p style={{ textAlign: 'center', marginTop: '2rem', fontWeight: 'bold' }}>Procesando cruce de datos...</p>}

      {file && !isProcessing && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee', marginBottom: '1rem' }}>
            <button 
                onClick={() => setActiveTab('cobranza')}
                style={{ padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'cobranza' ? '3px solid var(--brand)' : '3px solid transparent', fontWeight: activeTab === 'cobranza' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
                Cobranza ({diffs.filter(d => d.tab === 'cobranza').length})
            </button>
            <button 
                onClick={() => setActiveTab('compras')}
                style={{ padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'compras' ? '3px solid var(--brand)' : '3px solid transparent', fontWeight: activeTab === 'compras' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
                Compras ({diffs.filter(d => d.tab === 'compras').length})
            </button>
            <button 
                onClick={() => setActiveTab('caja')}
                style={{ padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'caja' ? '3px solid var(--brand)' : '3px solid transparent', fontWeight: activeTab === 'caja' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
                Caja Chica ({diffs.filter(d => d.tab === 'caja').length})
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tipo</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Registro</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Valor Anterior (Sistema)</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nuevo Valor (Excel)</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Variación</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiffs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No se detectaron diferencias en esta sección.</td>
                </tr>
              ) : (
                filteredDiffs.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                        {d.type === 'new' ? <span style={{ background: '#e6f4ea', color: '#137333', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>NUEVO</span> : 
                         <span style={{ background: '#fef7e0', color: '#b06000', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>MODIFICADO</span>}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{d.label}</td>
                    <td style={{ padding: '12px', color: '#666' }}>{typeof d.oldValue === 'number' ? `$${d.oldValue.toLocaleString()}` : d.oldValue || '—'}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{typeof d.newValue === 'number' ? `$${d.newValue.toLocaleString()}` : d.newValue}</td>
                    <td style={{ padding: '12px', color: typeof d.oldValue === 'number' && typeof d.newValue === 'number' ? (d.newValue > d.oldValue ? '#137333' : '#c5221f') : '#000' }}>
                        {typeof d.oldValue === 'number' && typeof d.newValue === 'number' ? `$${(d.newValue - d.oldValue).toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {diffs.length > 0 && (
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                <button 
                    onClick={applyChanges}
                    style={{ background: '#137333', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}
                >
                    Aplicar {diffs.length} Ajustes a Base de Datos
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
