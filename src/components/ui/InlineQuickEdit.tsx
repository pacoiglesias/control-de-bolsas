import React, { useState, useRef, useEffect } from 'react';

interface InlineQuickEditProps {
  value: string | number;
  onSave: (newValue: string) => Promise<void> | void;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  displayFormatter?: (val: any) => string;
  badgeStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  title?: string;
  emptyLabel?: string;
}

export const InlineQuickEdit: React.FC<InlineQuickEditProps> = ({
  value,
  onSave,
  type = 'text',
  placeholder = 'Editar...',
  displayFormatter,
  badgeStyle = {},
  inputStyle = {},
  title = 'Clic para editar directamente',
  emptyLabel = '—',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentVal(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = async () => {
    const trimmed = currentVal.trim();
    if (trimmed === String(value ?? '').trim()) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      await onSave(trimmed);
      setIsEditing(false);
    } catch (err) {
      console.error('Error al guardar edición rápida:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setCurrentVal(String(value ?? ''));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <input
          ref={inputRef}
          type={type}
          value={currentVal}
          placeholder={placeholder}
          disabled={saving}
          onChange={(e) => setCurrentVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleCommit()}
          style={{
            fontSize: 12,
            padding: '3px 8px',
            borderRadius: 6,
            border: '1.5px solid var(--accent, #7c3aed)',
            background: 'var(--paper, #1e293b)',
            color: 'var(--ink, #fff)',
            outline: 'none',
            minWidth: 80,
            maxWidth: 160,
            boxShadow: '0 0 8px rgba(124, 58, 237, 0.4)',
            ...inputStyle,
          }}
        />
        {saving && <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>💾</span>}
      </div>
    );
  }

  const display = displayFormatter ? displayFormatter(value) : (value ? String(value) : emptyLabel);
  const isEmpty = !value || String(value).trim() === '';

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title={title}
      className="inline-edit-hover-trigger"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 6,
        transition: 'all 0.15s ease',
        border: '1px solid transparent',
        color: isEmpty ? 'var(--ink-faint, rgba(255,255,255,0.35))' : 'inherit',
        ...badgeStyle,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.4)';
        e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = badgeStyle.borderColor as string || 'transparent';
        e.currentTarget.style.background = badgeStyle.background as string || 'transparent';
      }}
    >
      <span>{display}</span>
      <span style={{ fontSize: 10, opacity: 0.5 }}>✏️</span>
    </span>
  );
};
