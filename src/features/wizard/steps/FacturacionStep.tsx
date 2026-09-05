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
