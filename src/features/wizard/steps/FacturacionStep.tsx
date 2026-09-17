import React from 'react';
import { FacturaForm, type FacturaFormData } from '../../../components/forms/FacturaForm';

export interface FacturacionStepProps {
  initialData?: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export const FacturacionStep: React.FC<FacturacionStepProps> = ({
  initialData = {},
  onComplete,
  onBack,
}) => {
  const kilosFromReception = Number(
    initialData?.recepcionData?.receivedKilos ||
    initialData?.totalKilograms ||
    initialData?.ocData?.totalKilograms ||
    1500
  );
  const salePrice = Number(
    initialData?.salePricePerKg ||
    initialData?.ocData?.salePricePerKg ||
    43
  );
  const orderFolio = initialData?.folio || initialData?.ocData?.folio || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>
          Paso 3: Emisión y Conciliación de Factura (CFDI)
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Emite la factura asociada. Los kilos y precios se calculan automáticamente a partir de la báscula y la orden.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const subtotal = kilosFromReception * salePrice;
            const iva = subtotal * 0.16;
            const total = subtotal + iva;
            onComplete({
              facturaData: {
                folioFactura: `F-${Date.now().toString().slice(-4)}`,
                uuidFiscal: `UUID-${Date.now()}`,
                invoiceKilos: kilosFromReception,
                salePricePerKg: salePrice,
                subtotal,
                iva,
                total,
                paymentMethod: 'PPD',
                contrarecibo: '',
                notes: `Facturado automático desde báscula (${kilosFromReception} kg)`,
              },
            });
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: '#fff',
            border: 'none',
            fontWeight: 800,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            cursor: 'pointer',
          }}
          title="Usa los kilos exactos de báscula y el precio de la OC para facturar en 1 clic"
        >
          <span>⚡</span>
          <span>Facturar con datos de báscula en 1 Clic ➔</span>
        </button>
      </div>

      <FacturaForm
        initialData={initialData?.facturaData || initialData}
        kilosFromReception={kilosFromReception}
        salePricePerKg={salePrice}
        orderFolio={orderFolio}
        onSubmit={(formData: FacturaFormData) => onComplete({ facturaData: formData })}
        onCancel={onBack}
        submitLabel="Siguiente: Revisar y Confirmar ➔"
      />
    </div>
  );
};

export default FacturacionStep;
