import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { kilos } from '../../lib/format';
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
    orders.forEach((o) => {
      (o.deliveries || []).forEach((d: any) => {
        const rawDate = (d.date as any)?.toDate?.() || (d.date ? new Date(d.date) : null);
        if (rawDate) {
          const date = new Date(rawDate);
          if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            totalMonth += (d.kilos || 0);
          }
        }
      });
    });

    // Si no hay entregas con fecha de este mes, suma las entregas de órdenes activas
    if (totalMonth === 0) {
      orders.forEach((o) => {
        (o.deliveries || []).forEach((d: any) => {
          totalMonth += (d.kilos || 0);
        });
      });
    }

    return round2(totalMonth);
  }, [orders]);

  const percentage = Math.min(100, Math.round((currentMonthKilos / targetKilos) * 100));

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
        <span style={{ fontSize: 11, fontWeight: 700, color: percentage >= 100 ? '#10b981' : '#f59e0b' }}>
          {percentage}% de la meta
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-soft)' }}>Kilos Entregados:</span>
            <span style={{ fontWeight: 800, color: 'var(--ink)', fontFamily: 'monospace' }}>
              {kilos(currentMonthKilos)}
            </span>
          </div>

          <div
            role="meter"
            aria-valuenow={currentMonthKilos}
            aria-valuemin={0}
            aria-valuemax={targetKilos}
            aria-label={`Progreso de entregas: ${kilos(currentMonthKilos)} de ${kilos(targetKilos)} (${percentage}%)`}
            style={{
              height: 12,
              background: 'var(--paper-sunk)',
              borderRadius: 6,
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
                  ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(90deg, #f59e0b 0%, #10b981 100%)',
                borderRadius: 6,
              }}
            />
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
