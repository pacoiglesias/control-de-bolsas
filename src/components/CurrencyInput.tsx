import React, { useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (val: number) => void;
  currency?: boolean;
}

export function CurrencyInput({ value, onChange, currency = true, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Solo actualizar si no estamos enfocados para evitar saltos del cursor
    if (document.activeElement?.id !== props.id) {
      formatAndSet(value);
    }
  }, [value, props.id]);

  const formatAndSet = (val: number) => {
    if (isNaN(val)) return setDisplayValue('');
    const formatter = new Intl.NumberFormat('es-MX', {
      style: currency ? 'currency' : 'decimal',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setDisplayValue(formatter.format(val));
  };

  const handleBlur = () => {
    formatAndSet(value);
  };

  const handleFocus = () => {
    // Al enfocar, quitamos el formato para facilitar la edicion
    setDisplayValue(value.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    setDisplayValue(rawValue);
    const parsed = parseFloat(rawValue);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
}
