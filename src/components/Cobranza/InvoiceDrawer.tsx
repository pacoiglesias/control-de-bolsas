import { useState } from 'react';
import { Drawer, Field, Card } from '../ui';
import { money, toInputDate } from '../../lib/format';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { useInvoiceActions } from '../OrderModal/useInvoiceActions';
import { Timestamp } from 'firebase/firestore';
import { extractCr } from '../../lib/finance';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';
import { useToast } from '../../context/ToastContext';

interface InvoiceDrawerProps {
  invoice: Invoice;
  order: PurchaseOrder;
  dynamicConfig: any;
  onClose: () => void;
}

export function InvoiceDrawer({ invoice, order, dynamicConfig, onClose }: InvoiceDrawerProps) {
  const toast = useToast();
  const { saveInvoice } = useInvoiceActions();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);
  const [pdfBusy, setPdfBusy] = useState(false);
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
    const rawCr = (localInvoice.collection?.contrareciboNumber || '').trim().toUpperCase();
    const isTH = order.department === 'TH' || (order.client || '').toUpperCase().includes('TH');
    const isGT = order.department === 'GT' || (order.client || '').toUpperCase().includes('GT');

    if (isTH && rawCr.startsWith('GT-')) {
      toast('⚠️ Separación Estricta: Las facturas de TH no pueden llevar un contrarecibo GT.', 'bad');
      return;
    }
    if (isGT && rawCr.startsWith('TH-')) {
      toast('⚠️ Separación Estricta: Las facturas de GT no pueden llevar un contrarecibo TH.', 'bad');
      return;
    }

    await saveInvoice(order, localInvoice, dynamicConfig);
    onClose();
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      await generatePrefacturaPdf(order, localInvoice);
    } finally {
      setPdfBusy(false);
    }
  };

  const cr = extractCr(localInvoice, order);
  const isLate = localInvoice.creditCycle.status === 'overdue';
  
  return (
    <Drawer
      title={`Factura ${localInvoice.folio || order.folio || 'S/N'}`}
      onClose={onClose}
      side="right"
      width={480}
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
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

        {/* DESGLOSE DE CONCEPTOS Y SUBPRODUCTOS */}
        <Card title="📦 Conceptos & Subproductos">
          <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Kilos Facturados:</span>
            <strong className="mono" style={{ fontSize: 14 }}>{(localInvoice.kilos || 0).toLocaleString('es-MX')} kg</strong>
          </div>
          {localInvoice.collection?.notes && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 8, background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6 }}>
              {localInvoice.collection.notes}
            </div>
          )}
          {localInvoice.items && localInvoice.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {localInvoice.items.map((it, idx) => (
                <div key={it.id || idx} style={{ background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{it.description}</div>
                    <div style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>Clave SAT: {it.code || '24111500'}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>
                    {(it.quantity || 0).toLocaleString('es-MX')} kg
                  </div>
                </div>
              ))}
            </div>
          ) : order.items && order.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {order.items.map((it, idx) => (
                <div key={it.id || idx} style={{ background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{it.description}</div>
                    <div style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>Código: {it.code || 'S/C'}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>
                    {(it.quantity || 0).toLocaleString('es-MX')} kg
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
              Concepto general de venta de polietileno.
            </div>
          )}
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginTop: 12, background: 'var(--paper)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 12.5 }}
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
          >
            <span>📄</span> {pdfBusy ? 'Generando PDF...' : 'Descargar Prefactura PDF'}
          </button>
        </Card>

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
