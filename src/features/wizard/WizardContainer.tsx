import React, { useState } from 'react';
import { Stepper, Step, StepLabel } from '../../components/common/Stepper';
import OrdenCompraStep from './steps/OrdenCompraStep';
import RecepcionStep from './steps/RecepcionStep';
import FacturacionStep from './steps/FacturacionStep';
import ConfirmacionStep from './steps/ConfirmacionStep';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const steps = [
  'Orden de Compra',
  'Recepción de Báscula',
  'Facturación (CFDI)',
  'Confirmación y Resumen',
];

export const WizardContainer: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [wizardData, setWizardData] = useState<Record<string, any>>({});
  const navigate = useNavigate();

  const next = (data: any) => {
    setWizardData((prev) => ({ ...prev, ...data }));
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const back = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const reset = () => {
    setWizardData({});
    setActiveStep(0);
  };

  return (
    <div className="page" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header del Wizard */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🧙‍♂️</span>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
                Flujo Unificado de Compra y Facturación
              </h1>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Experiencia guiada de un clic: Compra ➔ Recepción en Báscula ➔ Factura SAT
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigate('/ordenes')}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13 }}
          >
            ✕ Salir a Órdenes
          </button>
          {activeStep > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={reset}
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13 }}
            >
              🔄 Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Stepper Superior */}
      <div
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '12px 20px',
          marginBottom: 24,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Stepper activeStep={activeStep}>
          {steps.map((label, idx) => (
            <Step key={label}>
              <StepLabel stepIndex={idx}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </div>

      {/* Contenido del Paso Activo con Animación de Transición */}
      <div
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)',
          minHeight: '450px',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {activeStep === 0 && (
              <OrdenCompraStep
                onComplete={next}
                initialData={wizardData}
                onCancel={() => navigate('/ordenes')}
              />
            )}
            {activeStep === 1 && (
              <RecepcionStep
                onComplete={next}
                initialData={wizardData}
                onBack={back}
              />
            )}
            {activeStep === 2 && (
              <FacturacionStep
                onComplete={next}
                initialData={wizardData}
                onBack={back}
              />
            )}
            {activeStep === 3 && (
              <ConfirmacionStep
                data={wizardData}
                onBack={back}
                onFinish={(_orderId) => navigate('/ordenes')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WizardContainer;
