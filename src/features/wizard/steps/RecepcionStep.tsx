import React from 'react';
import { RecepcionForm, type RecepcionFormData } from '../../../components/forms/RecepcionForm';

export interface RecepcionStepProps {
  initialData?: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export const RecepcionStep: React.FC<RecepcionStepProps> = ({
  initialData = {},
  onComplete,
  onBack,
}) => {
  const expectedKilos = Number(initialData?.totalKilograms || initialData?.ocData?.totalKilograms || 1500);
  const orderFolio = initialData?.folio || initialData?.ocData?.folio || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>
          Paso 2: Registro de Entrega y Recepción de Báscula
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Verifica los kilos físicos pesados en báscula respecto a la orden de compra. Los datos se prellenan desde la orden.
        </p>
      </div>

      <RecepcionForm
        initialData={initialData?.recepcionData || initialData}
        expectedKilos={expectedKilos}
        orderFolio={orderFolio}
        onSubmit={(formData: RecepcionFormData) => onComplete({ recepcionData: formData })}
        onCancel={onBack}
        submitLabel="Siguiente: Generar Factura ➔"
      />
    </div>
  );
};

export default RecepcionStep;
