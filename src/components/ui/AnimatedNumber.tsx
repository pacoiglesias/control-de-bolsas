import React, { useEffect, useState, useRef } from 'react';
import { money } from '../../lib/format';

interface AnimatedNumberProps {
  value: number;
  format?: 'money' | 'kilos' | 'number' | 'percent';
  decimals?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = 'money',
  decimals = 2,
  duration = 450,
  className = '',
  style = {},
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const startValueRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Easing cúbico fluido (easeOutCubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + (value - startValueRef.current) * easeProgress;
      
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatOutput = (val: number) => {
    if (format === 'money') {
      return money(val);
    }
    if (format === 'kilos') {
      return `${Math.round(val).toLocaleString('es-MX')} kg`;
    }
    if (format === 'percent') {
      return `${(val * 100).toFixed(decimals)}%`;
    }
    return val.toLocaleString('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <span className={`mono ${className}`} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {formatOutput(displayValue)}
    </span>
  );
};
