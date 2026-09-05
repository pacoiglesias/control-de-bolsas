import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AutocompleteRenderInputParams {
  ref: React.Ref<any>;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
}

export interface AutocompleteProps<T = any> {
  options: T[];
  getOptionLabel?: (option: T) => string;
  value?: T | null;
  onChange?: (event: any, newValue: T | null) => void;
  onInputChange?: (event: any, newInputValue: string) => void;
  renderInput?: (params: AutocompleteRenderInputParams) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  freeSolo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  ...rest
}: {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="field-input"
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          background: 'var(--field)',
          color: 'var(--ink)',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          ...rest.style,
        }}
        {...rest}
      />
    </div>
  );
}

export function Autocomplete<T = any>({
  options = [],
  getOptionLabel = (opt: any) => (typeof opt === 'string' ? opt : opt?.name || opt?.label || String(opt || '')),
  value,
  onChange,
  onInputChange,
  renderInput,
  placeholder = 'Buscar o seleccionar...',
  disabled = false,
  freeSolo = true,
  className = '',
  style = {},
}: AutocompleteProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>(() => {
    if (value) return getOptionLabel(value);
    return '';
  });
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value ? getOptionLabel(value) : '');
    }
  }, [value, getOptionLabel]);

  // Click away listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    setIsOpen(true);
    setHighlightedIndex(0);
    if (onInputChange) {
      onInputChange(e, text);
    }
    if (freeSolo && onChange) {
      // FreeSolo emits the typed string or an object with that name
      onChange(e, text as any);
    }
  };

  const handleSelectOption = (option: T, event: any) => {
    const label = getOptionLabel(option);
    setInputValue(label);
    setIsOpen(false);
    if (onChange) {
      onChange(event, option);
    }
    if (onInputChange) {
      onInputChange(event, label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < options.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : options.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
        e.preventDefault();
        handleSelectOption(options[highlightedIndex], e);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const inputParams: AutocompleteRenderInputParams = {
    ref: inputRef,
    value: inputValue,
    onChange: handleInputChange,
    onFocus: () => setIsOpen(true),
    onBlur: () => {
      // small timeout so click event on option fires
      setTimeout(() => {
        if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
          setIsOpen(false);
        }
      }, 150);
    },
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    autoComplete: 'off',
  };

  return (
    <div
      ref={containerRef}
      className={`cb-autocomplete-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      {renderInput ? (
        renderInput(inputParams)
      ) : (
        <TextField
          {...inputParams}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}

      <AnimatePresence>
        {isOpen && options.length > 0 && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              padding: '6px',
            }}
          >
            <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
              ⚡ Sugerencias Rápidas
            </div>
            {options.map((option, idx) => {
              const label = getOptionLabel(option);
              const isSelected = value ? getOptionLabel(value) === label : false;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOption(option, e);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isHighlighted
                      ? 'var(--accent-tint)'
                      : isSelected
                      ? 'var(--paper-sunk)'
                      : 'transparent',
                    color: isHighlighted ? 'var(--accent-deep)' : 'var(--ink)',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {idx < 3 && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(217, 119, 6, 0.12)',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      Frecuente
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
