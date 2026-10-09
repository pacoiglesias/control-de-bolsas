import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type FinancialConcept =
  | 'subtotal'
  | 'iva'
  | 'total_con_iva'
  | 'comision_contador'
  | 'margen_bruto'
  | 'flujo_caja'
  | 'contrarecibo'
  | 'pago_parcial'
  | 'kilos_bascula'
  | 'kilos_facturados';

interface ConceptDefinition {
  title: string;
  explanation: string;
  example: string;
  formula?: string;
}

const DEFINITIONS: Record<FinancialConcept, ConceptDefinition> = {
  subtotal: {
    title: 'Subtotal (Base Imponible)',
    explanation: 'Importe de la venta antes de aplicar impuestos. Es el valor real de la mercancía y la base sobre la que se calcula la comisión del contador (8%).',
    example: '1,000 kg × $43.00/kg = $43,000.00 MXN',
    formula: 'Kilos × Precio Venta ($43.00)',
  },
  iva: {
    title: 'IVA Trasladado (16%)',
    explanation: 'Impuesto al Valor Agregado obligatorio que se factura a Grupo Textil Providencia. Es dinero que la empresa recauda pero debe liquidar al SAT; NO es utilidad.',
    example: '$43,000.00 × 16% = $6,880.00 MXN',
    formula: 'Subtotal × 0.16',
  },
  total_con_iva: {
    title: 'Total Factura (con IVA)',
    explanation: 'El monto final amparado en el CFDI 4.0 que deposita Providencia en banco. Corresponde al precio oficial de $49.88/kg con IVA incluido.',
    example: '$43,000.00 + $6,880.00 = $49,880.00 MXN',
    formula: 'Subtotal + IVA (o Kilos × $49.88)',
  },
  comision_contador: {
    title: 'Comisión del Contador (8.0%)',
    explanation: 'Honorario por gestión y cobranza fiscal. Se calcula estrictamente sobre el SUBTOTAL antes de IVA, nunca sobre el total de la factura.',
    example: '$43,000.00 × 8% = $3,440.00 MXN',
    formula: 'Subtotal × 0.08',
  },
  margen_bruto: {
    title: 'Margen de Utilidad Real (sin IVA)',
    explanation: 'Ganancia neta del negocio por kilo después de pagar la maquila a Andrés ($38/kg de referencia) y la comisión del contador ($3.44/kg).',
    example: 'Venta $43 - Costo $38 - Comisión $3.44 = $1.56/kg de utilidad neta.',
    formula: 'Subtotal - Costo Maquila - Comisión Contador',
  },
  flujo_caja: {
    title: 'Flujo de Efectivo Disponible',
    explanation: 'Efectivo temporal recibido en cuenta tras cobrar la factura y pagar maquila y comisión, ANTES de transferir el IVA al SAT.',
    example: 'Factura $49.88 - Costo $38.00 - Comisión $3.44 = $8.44/kg en banco temporalmente.',
    formula: 'Total Cobrado - Costo - Comisión',
  },
  contrarecibo: {
    title: 'Contrarecibo Oficial (CR)',
    explanation: 'Folio asignado por Providencia en su portal (ej. GT-1020 o TH-1195) tras validar las remisiones de báscula y el CFDI. Fija la fecha formal de pago.',
    example: 'Sin CR la factura permanece "En Revisión" y no tiene fecha de pago programada.',
  },
  pago_parcial: {
    title: 'Pago Parcial / Abono',
    explanation: 'Depósito que cubre solo una porción del saldo de la factura. La factura mantiene estatus "Por Cobrar" con el saldo remanente visible.',
    example: 'Factura de $49,880 con abono de $20,000 deja un saldo pendiente de $29,880.',
  },
  kilos_bascula: {
    title: 'Kilos Entregados en Báscula',
    explanation: 'Kilos reales recibidos físicamente en planta confirmados por boleta de pesaje o remisión sellada en Almacén P4 / Almacén 1.',
    example: 'Es la verdad física de lo entregado, independiente de si ya está facturado.',
  },
  kilos_facturados: {
    title: 'Kilos Facturados (CFDI SAT)',
    explanation: 'Kilos amparados formalmente ante el SAT mediante facturas electrónicas timbradas. Si difiere de báscula, existe un descuadre que conciliar.',
    example: 'Kilos Báscula - Kilos Facturados = Kilos en patio pendientes de facturar.',
  },
};

interface FinancialHelpTooltipProps {
  concept: FinancialConcept;
  compact?: boolean;
}

export const FinancialHelpTooltip: React.FC<FinancialHelpTooltipProps> = ({ concept, compact = false }) => {
  const [open, setOpen] = useState(false);
  const def = DEFINITIONS[concept];

  if (!def) return null;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={`Ayuda sobre ${def.title}`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: compact ? 11 : 13,
          color: open ? '#38bdf8' : '#94a3b8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ℹ️
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 8,
              width: 260,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              pointerEvents: 'none',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>
              {def.title}
            </div>
            <div style={{ fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.35, marginBottom: 6 }}>
              {def.explanation}
            </div>
            {def.formula && (
              <div style={{ fontSize: 10.5, color: '#fbbf24', fontFamily: 'monospace', marginBottom: 4, background: 'rgba(251, 191, 36, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                Fórmula: {def.formula}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: '#94a3b8', fontStyle: 'italic' }}>
              Ejemplo: {def.example}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};
