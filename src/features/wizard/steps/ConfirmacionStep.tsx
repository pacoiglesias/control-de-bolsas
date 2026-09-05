import React, { useState } from 'react';
import { doc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { computeFinancials } from '../../../lib/finance';
import { money, kilos } from '../../../lib/format';
import { DEFAULT_CONFIG } from '../../../lib/types';
import { triggerHaptic } from '../../../lib/hapticEngine';
import { triggerCelebrationConfetti } from '../../../lib/confetti';
import { logAction } from '../../../lib/logger';
import { useNavigate } from 'react-router-dom';

export interface ConfirmacionStepProps {
  data: any;
  onBack: () => void;
  onFinish?: (orderId: string) => void;
}

export const ConfirmacionStep: React.FC<ConfirmacionStepProps> = ({
  data,
  onBack,
  onFinish,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const oc = data?.ocData || data || {};
  const rec = data?.recepcionData || {};
  const fact = data?.facturaData || {};

  const orderKilos = Number(rec?.receivedKilos || oc?.totalKilograms || 1500);
  const salePrice = Number(fact?.salePricePerKg || oc?.salePricePerKg || 43);
  const costPrice = Number(oc?.costPricePerKg || 38);

  const fin = computeFinancials(orderKilos, {
    ...DEFAULT_CONFIG,
    salePricePerKg: salePrice,
    costPricePerKg: costPrice,
  });

  const handleFinalize = async () => {
    setSaving(true);
    try {
      const orderId = `ord_${Date.now()}`;
      const orderRef = doc(db, PATHS.orders, orderId);

      const realFolio = oc.folio || `OC-${Date.now().toString().slice(-6)}`;
      const clientName = oc.client || 'GRUPO TEXTIL PROVIDENCIA';
      const department = oc.department || (clientName.includes('TH') ? 'TH' : 'GT');

      const invoiceId = `inv_${Date.now()}`;
      const facturaFolio = fact.folioFactura || `F-${Date.now().toString().slice(-4)}`;

      const newOrder = {
        id: orderId,
        folio: realFolio,
        oc: realFolio,
        client: clientName,
        department: department === 'TH' ? 'TH-ALMACEN-1' : 'P4-ALM',
        productDescription: oc.productDescription || 'Bolsa de Polietileno Transparente en Rollo',
        totalKilograms: orderKilos,
        status: fact.folioFactura ? 'facturado' : 'pedido',
        financials: {
          salePricePerKg: salePrice,
          costPricePerKg: costPrice,
          saleTotal: fact.subtotal || fin.saleTotal,
          invoiceTotal: fact.total || fin.invoiceTotal,
          commission: fin.commission,
          costTotal: fin.costTotal,
          netCashFlow: fin.netCashFlow,
        },
        creditCycle: {
          status: fact.contrarecibo ? 'pending' : 'pedido',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + (Number(oc.creditDays) || 30) * 24 * 60 * 60 * 1000),
        },
        items: oc.items || [
          {
            description: oc.productDescription || 'Bolsa de Polietileno Transparente en Rollo',
            quantity: orderKilos,
            unitPrice: salePrice,
            amount: orderKilos * salePrice,
          },
        ],
        deliveries: rec.remisionNumber
          ? [
              {
                id: `del_${Date.now()}`,
                remision: rec.remisionNumber,
                kilos: orderKilos,
                date: rec.deliveryDate ? Timestamp.fromDate(new Date(rec.deliveryDate)) : Timestamp.now(),
                driver: rec.driverName || '',
                plates: rec.vehiclePlates || '',
                notes: rec.receptionNotes || '',
                createdAt: Timestamp.now(),
              },
            ]
          : [],
        invoices: fact.folioFactura
          ? [
              {
                id: invoiceId,
                folio: facturaFolio,
                uuid: fact.uuidFiscal || null,
                kilos: orderKilos,
                creditCycle: {
                  status: fact.contrarecibo ? 'pending' : 'in_review',
                  issueDate: Timestamp.now(),
                  dueDate: Timestamp.fromMillis(Date.now() + (Number(oc.creditDays) || 30) * 24 * 60 * 60 * 1000),
                },
                collection: {
                  contrareciboNumber: fact.contrarecibo || '',
                },
                financials: {
                  saleTotal: fact.subtotal || fin.saleTotal,
                  invoiceTotal: fact.total || fin.invoiceTotal,
                },
              },
            ]
          : [],
        invoiceStatuses: fact.folioFactura ? [fact.contrarecibo ? 'pending' : 'in_review'] : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        wizardCreated: true,
      };

      await setDoc(orderRef, newOrder);

      await logAction(
        user?.email || 'Sistema',
        `Proceso unificado de compra completado: OC ${realFolio} con Factura ${facturaFolio}`,
        { orderId, folio: realFolio, kilos: orderKilos, total: fin.invoiceTotal }
      );

      triggerHaptic('success');
      triggerCelebrationConfetti();
      toast(`✅ Expediente ${realFolio} creado y facturado exitosamente`, 'ok');

      if (onFinish) {
        onFinish(orderId);
      } else {
        navigate('/ordenes');
      }
    } catch (error: any) {
      console.error('Error al finalizar wizard:', error);
      triggerHaptic('error');
      toast(`Error al guardar expediente: ${error.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>
          Paso 4: Resumen y Confirmación Final
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Revisa el expediente unificado antes de procesarlo. Se registrará la orden de compra, la recepción en báscula y la factura en una sola operación.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Tarjeta 1: Orden de Compra */}
        <div
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
            <span style={{ fontSize: 18 }}>📝</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Orden de Compra</span>
          </div>
          <div style={{ fontSize: 13 }}><strong>Folio:</strong> {oc.folio || 'S/F'}</div>
          <div style={{ fontSize: 13 }}><strong>Cliente:</strong> {oc.client || 'N/A'}</div>
          <div style={{ fontSize: 13 }}><strong>Proveedor:</strong> {oc.provider || 'N/A'}</div>
          <div style={{ fontSize: 13 }}><strong>Producto:</strong> {oc.productDescription || 'N/A'}</div>
          <div style={{ fontSize: 13 }}><strong>Solicitado:</strong> {kilos(oc.totalKilograms || 0)}</div>
        </div>

        {/* Tarjeta 2: Recepción */}
        <div
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
            <span style={{ fontSize: 18 }}>⚖️</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Recepción de Báscula</span>
          </div>
          <div style={{ fontSize: 13 }}><strong>Remisión:</strong> {rec.remisionNumber || 'S/R'}</div>
          <div style={{ fontSize: 13 }}><strong>Kilos Pesados:</strong> <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{kilos(rec.receivedKilos || 0)}</span></div>
          <div style={{ fontSize: 13 }}><strong>Fecha:</strong> {rec.deliveryDate || 'Hoy'}</div>
          <div style={{ fontSize: 13 }}><strong>Chofer / Placas:</strong> {rec.driverName || 'N/A'} ({rec.vehiclePlates || 'N/A'})</div>
          <div style={{ fontSize: 13 }}><strong>Calidad:</strong> {rec.qualityPassed ? '✅ Aprobado' : '⚠️ Observaciones'}</div>
        </div>

        {/* Tarjeta 3: Factura */}
        <div
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🧾</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Factura CFDI</span>
          </div>
          <div style={{ fontSize: 13 }}><strong>Folio Factura:</strong> {fact.folioFactura || 'Pendiente'}</div>
          <div style={{ fontSize: 13 }}><strong>Total Facturado:</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{money(fact.total || fin.invoiceTotal)}</span></div>
          <div style={{ fontSize: 13 }}><strong>Método:</strong> {fact.paymentMethod || 'PPD'}</div>
          <div style={{ fontSize: 13 }}><strong>Contrarecibo:</strong> {fact.contrarecibo || 'Por tramitar'}</div>
          <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>UUID:</strong> {fact.uuidFiscal || 'Se timbrará en portal'}
          </div>
        </div>
      </div>

      {/* Balance y Rentabilidad */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(5, 150, 105, 0.1) 100%)',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 12 }}>
          💼 Rentabilidad del Expediente Unificado
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Ingreso Bruto (c/IVA)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{money(fin.invoiceTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Costo Maquila / Resina</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bad)' }}>{money(fin.costTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Honorario Contador (8%)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-soft)' }}>{money(fin.commission)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Margen Neto Disponible</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>{money(fin.netCashFlow)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <button
          type="button"
          className="btn ghost"
          onClick={onBack}
          disabled={saving}
          style={{ padding: '12px 24px', borderRadius: '10px' }}
        >
          ⬅ Modificar Pasos Anteriores
        </button>

        <button
          type="button"
          className="btn primary"
          onClick={handleFinalize}
          disabled={saving}
          style={{
            padding: '14px 32px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px 0 rgba(217, 119, 6, 0.4)',
          }}
        >
          {saving ? '⏳ Procesando Expediente...' : '🚀 Finalizar y Guardar Proceso Completo'}
        </button>
      </div>
    </div>
  );
};

export default ConfirmacionStep;
