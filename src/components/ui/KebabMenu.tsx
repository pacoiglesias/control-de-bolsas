import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface KebabMenuItem {
  id?: string;
  icon?: string | React.ReactNode;
  label: string;
  sublabel?: string;
  badge?: string | number;
  tone?: 'default' | 'primary' | 'success' | 'warn' | 'danger' | 'accent';
  disabled?: boolean;
  dividerBefore?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  align?: 'left' | 'right';
  triggerSize?: 'sm' | 'md';
  title?: string;
  buttonClassName?: string;
}

export function KebabMenu({
  items,
  align = 'right',
  triggerSize = 'sm',
  title = 'Más opciones',
  buttonClassName = '',
}: KebabMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sizeStyles = triggerSize === 'sm'
    ? { width: 30, height: 30, fontSize: 16 }
    : { width: 36, height: 36, fontSize: 18 };

  const getToneColors = (tone?: KebabMenuItem['tone']) => {
    switch (tone) {
      case 'primary':
        return { color: 'var(--accent)', bgHover: 'var(--accent-tint)' };
      case 'success':
        return { color: '#059669', bgHover: '#ecfdf5' };
      case 'warn':
        return { color: '#d97706', bgHover: '#fffbeb' };
      case 'danger':
        return { color: '#dc2626', bgHover: '#fef2f2' };
      case 'accent':
        return { color: '#7c3aed', bgHover: '#f5f3ff' };
      default:
        return { color: 'var(--ink)', bgHover: 'var(--paper-sunk)' };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Botón Trigger Kebab (⋮) */}
      <button
        type="button"
        title={title}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        className={`kebab-trigger-btn ${buttonClassName}`}
        style={{
          ...sizeStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: isOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
          background: isOpen ? 'var(--accent-tint)' : 'var(--paper)',
          color: isOpen ? 'var(--accent)' : 'var(--ink)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-tint)' : 'none',
        }}
      >
        <span style={{ transform: 'translateY(-1px)', fontWeight: 900, lineHeight: 1 }}>⋮</span>
      </button>

      {/* Menú Desplegable Flotante */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              [align === 'right' ? 'right' : 'left']: 0,
              minWidth: 220,
              background: 'var(--paper-raised)',
              border: '1px solid var(--line-soft)',
              borderRadius: 12,
              boxShadow: '0 10px 28px -4px rgba(0, 0, 0, 0.18), 0 4px 10px -2px rgba(0, 0, 0, 0.08)',
              padding: '6px',
              zIndex: 999,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {items.map((item, index) => {
              const { color, bgHover } = getToneColors(item.tone);

              return (
                <React.Fragment key={item.id || index}>
                  {item.dividerBefore && (
                    <div
                      style={{
                        height: 1,
                        background: 'var(--line-soft)',
                        margin: '4px 6px',
                      }}
                    />
                  )}

                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.disabled) return;
                      setIsOpen(false);
                      item.onClick(e);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: item.disabled ? 'var(--ink-faint)' : color,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!item.disabled) {
                        e.currentTarget.style.background = bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {item.icon && (
                      <span style={{ fontSize: 14, display: 'flex', alignItems: 'center', width: 18, justifyContent: 'center' }}>
                        {item.icon}
                      </span>
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ lineHeight: 1.2 }}>{item.label}</span>
                      {item.sublabel && (
                        <span style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2, fontWeight: 500 }}>
                          {item.sublabel}
                        </span>
                      )}
                    </div>

                    {item.badge !== undefined && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: 'var(--paper-sunk)',
                          color: 'var(--ink-soft)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
