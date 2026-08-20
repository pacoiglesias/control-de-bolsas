import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { kilos, toDate } from '../../lib/format';
import { round2 } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';

interface KilosSpeedometerProps {
  orders: PurchaseOrder[];
  targetKilos?: number;
}

export function KilosSpeedometer({ orders, targetKilos = 50000 }: KilosSpeedometerProps) {
  const currentMonthKilos = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalMonth = 0;
    (orders || []).forEach((o) => {
      if (!o) return;
      (o.deliveries || []).forEach((d: any) => {
        if (!d) return;
        const date = toDate(d.date);
        if (date && date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          totalMonth += (Number(d.kilos) || 0);
        }
      });
    });

    // Si no hay entregas con fecha de este mes, suma las entregas de órdenes activas
    if (totalMonth === 0) {
      (orders || []).forEach((o) => {
        if (!o) return;
        (o.deliveries || []).forEach((d: any) => {
          if (!d) return;
          totalMonth += (Number(d.kilos) || 0);
        });
      });
    }

    return round2(totalMonth);
  }, [orders]);

  const safeTarget = targetKilos > 0 ? targetKilos : 50000;
  const percentage = Math.min(100, Math.round((currentMonthKilos / safeTarget) * 100));

  return (
    <div
      role="region"
      aria-label="Tacómetro y medidor de kilos entregados en el mes"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⏱️</span> Tacómetro de Kilos del Mes
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-soft)' }}>Kilos Entregados:</span>
            <span style={{ fontWeight: 800, color: 'var(--ink)', fontFamily: 'monospace' }}>
              {kilos(currentMonthKilos)}
            </span>
          </div>

          {/* FIX (v8.9.3): la barra era de 12px y el porcentaje vivía aparte,
              arriba a la derecha del título -- fácil de no ver de reojo.
              Ahora la barra mide casi el doble (22px) y el porcentaje va
              encimado en el propio relleno, así el número y el avance se
              leen en un solo lugar de un vistazo. */}
          <div
            role="meter"
            aria-valuenow={currentMonthKilos}
            aria-valuemin={0}
            aria-valuemax={targetKilos}
            aria-label={`Progreso de entregas: ${kilos(currentMonthKilos)} de ${kilos(targetKilos)} (${percentage}%)`}
            style={{
              height: 22,
              background: 'var(--paper-sunk)',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid var(--line-soft)',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: percentage >= 100
                  ? 'var(--ok)'
                  : 'linear-gradient(90deg, var(--warn) 0%, var(--ok) 100%)',
                borderRadius: 8,
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                pointerEvents: 'none',
              }}
            >
              {percentage}% de la meta
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--ink-soft)' }}>
            <span>0 kg</span>
            <span>Meta: {kilos(targetKilos)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
