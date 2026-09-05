import { OrdenCompraForm } from '../../../components/forms/OrdenCompraForm';

export interface OrdenCompraStepProps {
  initialData?: any;
  onComplete: (data: any) => void;
  onCancel?: () => void;
}

export const OrdenCompraStep: React.FC<OrdenCompraStepProps> = ({
  initialData = {},
  onComplete,
  onCancel,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>
          Paso 1: Captura de Orden de Compra (OC)
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Ingresa los datos generales del pedido. Los campos de cliente, proveedor y producto se autocompletan con base en tu historial.
        </p>
      </div>

      <OrdenCompraForm
        initialData={initialData}
        onSubmit={(formData) => onComplete({ ocData: formData, ...formData })}
        onCancel={onCancel}
        submitLabel="Siguiente: Registro de Recepción ➔"
      />
    </div>
  );
};

export default OrdenCompraStep;
