import { useState } from 'react';
import { Drawer, Field, Card } from '../ui';
import { money } from '../../lib/format';
import type { Purchase } from '../../lib/types';
import { doc, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';

interface PurchaseDrawerProps {
  purchase: Purchase;
  folio?: string;
  onClose: () => void;
}

export function PurchaseDrawer({ purchase, folio, onClose }: PurchaseDrawerProps) {
  const [localPurchase, setLocalPurchase] = useState<Purchase>(purchase);
  const toast = useToast();
  const hasChanges = JSON.stringify(purchase) !== JSON.stringify(localPurchase);
  
  const updateField = (fieldPath: string[], value: any) => {
    setLocalPurchase(prev => {
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
    try {
      const ref = doc(db, PATHS.purchases, purchase.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('La orden ya no existe.');
        // Actualizamos estatus de pago y notas internas (Cuentas por pagar)
        tx.update(ref, {
          status: localPurchase.status,
          paidAmount: localPurchase.paidAmount,
          notes: localPurchase.notes || '',
        });
      });
      toast('Cuentas por pagar actualizadas', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al guardar: ${e.message}`, 'bad');
    }
  };

  const prov = localPurchase.provider || 'Sin Proveedor';
  const costoTotal = localPurchase.totalAmount || 0;
  
  return (
    <Drawer
      title={`Orden de Compra ${folio || 'S/N'}`}
      onClose={onClose}
      side="right"
      width={450}
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)', borderTop: `4px solid var(--accent)` }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>Proveedor / Maquilero</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{prov}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Costo Total</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{money(costoTotal)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Kilos Esperados</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{localPurchase.expectedKilos} kg</div>
            </div>
          </div>
        </div>

        <Card title="Cuentas por Pagar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Monto Pagado">
              <input
                type="number"
                value={localPurchase.paidAmount ?? 0}
                onChange={e => updateField(['paidAmount'], Number(e.target.value))}
              />
            </Field>

            <Field label="Estatus de Pago">
              <select
                value={localPurchase.status || 'pending'}
                onChange={e => updateField(['status'], e.target.value)}
              >
                <option value="pending">Pendiente / Pedido</option>
                <option value="paid">Pagado Completo</option>
              </select>
            </Field>
            
            <Field label="Notas de Pago (Transferencia / Caja Chica)">
              <textarea
                value={localPurchase.notes || ''}
                onChange={e => updateField(['notes'], e.target.value)}
                placeholder="Anotar detalles de depósitos, cuentas o si se pagó desde caja chica..."
                rows={4}
              />
            </Field>
          </div>
        </Card>

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
