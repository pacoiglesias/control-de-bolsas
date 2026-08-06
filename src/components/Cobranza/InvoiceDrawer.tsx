import { useState } from 'react';
import { Drawer, Field, Card } from '../ui';
import { money, toInputDate } from '../../lib/format';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { useInvoiceActions } from '../OrderModal/useInvoiceActions';
import { Timestamp } from 'firebase/firestore';

interface InvoiceDrawerProps {
  invoice: Invoice;
  order: PurchaseOrder;
  dynamicConfig: any;
  onClose: () => void;
}

export function InvoiceDrawer({ invoice, order, dynamicConfig, onClose }: InvoiceDrawerProps) {
  const { saveInvoice } = useInvoiceActions();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);
  const hasChanges = JSON.stringify(invoice) !== JSON.stringify(localInvoice);
  
  const updateField = (fieldPath: string[], value: any) => {
    setLocalInvoice(prev => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < fieldPath.length - 1; i++) {
        current[fieldPath[i]] = { ...current[fieldPath[i]] };
        current = current[fieldPath[i]];
      }
      current[fieldPath[fieldPath.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    await saveInvoice(order, localInvoice, dynamicConfig);
    onClose();
  };

  const cr = localInvoice.collection?.contrareciboNumber || order.collection?.contrareciboNumber;
  const isLate = localInvoice.creditCycle.status === 'overdue';
  
  return (
    <Drawer
      title={`Factura ${localInvoice.folio || order.folio || 'S/N'}`}
      onClose={onClose}
      side="right"
      width={450}
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ENCABEZADO Y STATUS */}
        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)', borderTop: `4px solid ${isLate ? 'var(--bad)' : 'var(--accent)'}` }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>Cliente</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{order.client}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Monto a Cobrar</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{money(localInvoice.financials?.invoiceTotal ?? localInvoice.financials?.saleTotal)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Contrarecibo</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: cr ? 'var(--ok)' : 'var(--ink)' }}>{cr || 'Falta CR'}</div>
            </div>
          </div>
        </div>

        {/* CONTRARECIBO Y FECHAS */}
        <Card title="Ciclo de Crédito">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Fecha Emisión">
              <input
                type="date"
                value={toInputDate(localInvoice.creditCycle.issueDate) || ''}
                onChange={e => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + 'T12:00:00');
                    updateField(['creditCycle', 'issueDate'], Timestamp.fromDate(d));
                  }
                }}
              />
            </Field>
            
            <Field label="Fecha Vencimiento">
              <input
                type="date"
                value={toInputDate(localInvoice.creditCycle.dueDate) || ''}
                onChange={e => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + 'T12:00:00');
                    updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(d));
                  }
                }}
              />
            </Field>
            
            <Field label="Folio Contrarecibo">
              <input
                type="text"
                value={localInvoice.collection?.contrareciboNumber ?? ''}
                onChange={e => updateField(['collection', 'contrareciboNumber'], e.target.value)}
                placeholder="Ej. GT-123"
              />
            </Field>

            <Field label="Estatus Cobranza">
              <select
                value={localInvoice.creditCycle.status}
                onChange={e => updateField(['creditCycle', 'status'], e.target.value)}
              >
                <option value="pending">Por Cobrar</option>
                <option value="overdue">Atrasado</option>
                <option value="paid">Pagado por Cliente (Falta depósito)</option>
                <option value="collected">En Caja / Depositado</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* ACCIONES */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '20px' }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button 
            className="btn" 
            style={{ flex: 1, background: 'var(--accent)', color: '#fff', opacity: hasChanges ? 1 : 0.5 }} 
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Guardar Cambios
          </button>
        </div>

      </div>
    </Drawer>
  );
}
