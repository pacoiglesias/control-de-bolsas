import React, { useState, useEffect, useCallback, useMemo } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (val: number) => void;
  currency?: boolean;
}

const FORMATTER_CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATTER_DECIMAL = new Intl.NumberFormat('es-MX', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function CurrencyInput({ value, onChange, currency = true, onFocus, onBlur, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const formatter = useMemo(() => (currency ? FORMATTER_CURRENCY : FORMATTER_DECIMAL), [currency]);

  const formatAndSet = useCallback((val: number) => {
    if (!Number.isFinite(val)) {
      setDisplayValue('');
      return;
    }
    setDisplayValue(formatter.format(val));
  }, [formatter]);

  useEffect(() => {
    // Solo actualizar el valor formateado si el usuario NO está editando activamente
    if (!isFocused) {
      formatAndSet(value);
    }
  }, [value, isFocused, formatAndSet]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Al enfocar, mostramos el número en texto simple sin el signo de pesos para facilitar edición
    setDisplayValue(value > 0 ? String(value) : '');
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    formatAndSet(value);
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir solo dígitos y un único punto decimal
    let rawValue = e.target.value.replace(/[^0-9.]/g, '');
    const parts = rawValue.split('.');
    if (parts.length > 2) {
      rawValue = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    setDisplayValue(rawValue);
    const parsed = parseFloat(rawValue);
    onChange(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
}
