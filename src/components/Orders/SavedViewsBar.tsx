import React, { useState, useEffect } from 'react';

export interface SavedView {
  id: string;
  name: string;
  filter: string;
  icon?: string;
}

const DEFAULT_VIEWS: SavedView[] = [
  { id: 'view-all', name: 'Todas las Órdenes', filter: 'all', icon: '📁' },
  { id: 'view-sin-cr', name: 'Sin Contrarecibo', filter: 'sin_cr', icon: '⚠️' },
  { id: 'view-overdue', name: 'Contrarecibos Vencidos', filter: 'overdue', icon: '🚨' },
  { id: 'view-paid', name: 'Con el Contador', filter: 'paid', icon: '🟡' },
  { id: 'view-collected', name: 'Cobrado y en Caja', filter: 'collected', icon: '✅' },
];

const STORAGE_KEY = 'CONTROL_BOLSAS_CUSTOM_SAVED_VIEWS';

interface SavedViewsBarProps {
  currentFilter: string;
  onSelectFilter: (filterKey: string) => void;
  style?: React.CSSProperties;
}

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
  currentFilter,
  onSelectFilter,
  style = {},
}) => {
  const [views, setViews] = useState<SavedView[]>(DEFAULT_VIEWS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const custom = JSON.parse(saved);
        setViews([...DEFAULT_VIEWS, ...custom]);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      filter: currentFilter,
      icon: '⭐',
    };
    const updated = [...views, newView];
    setViews(updated);
    try {
      const customOnly = updated.filter((v) => !DEFAULT_VIEWS.some((d) => d.id === v.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // ignore
    }
    setNewViewName('');
    setShowAddModal(false);
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = views.filter((v) => v.id !== id);
    setViews(updated);
    try {
      const customOnly = updated.filter((v) => !DEFAULT_VIEWS.some((d) => d.id === v.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        padding: '4px 2px',
        marginBottom: 12,
        ...style,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-faint)', textTransform: 'uppercase', marginRight: 4 }}>
        Vistas:
      </span>

      {views.map((v) => {
        const isSelected = currentFilter === v.filter;
        const isCustom = !DEFAULT_VIEWS.some((d) => d.id === v.id);

        return (
          <button
            key={v.id}
            onClick={() => onSelectFilter(v.filter)}
            style={{
              background: isSelected ? 'var(--accent)' : 'var(--paper)',
              color: isSelected ? '#fff' : 'var(--ink)',
              border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line-soft)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              boxShadow: isSelected ? '0 2px 8px rgba(217, 119, 6, 0.3)' : 'none',
            }}
          >
            {v.icon && <span style={{ fontSize: 12 }}>{v.icon}</span>}
            <span>{v.name}</span>
            {isCustom && (
              <span
                onClick={(e) => handleDeleteView(v.id, e)}
                style={{ marginLeft: 4, opacity: 0.6, fontSize: 11, cursor: 'pointer' }}
                title="Eliminar vista personalizada"
              >
                ✕
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => setShowAddModal(true)}
        title="Guardar vista actual como favorita"
        style={{
          background: 'transparent',
          border: '1px dashed var(--line)',
          borderRadius: 10,
          padding: '6px 10px',
          color: 'var(--ink-soft)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        + Guardar Vista
      </button>

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: 20,
              width: 320,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: 'var(--ink)' }}>Guardar Vista Personalizada</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--ink-soft)' }}>
              Guarda el filtro actual (&ldquo;{currentFilter}&rdquo;) para acceder rápidamente.
            </p>
            <input
              type="text"
              placeholder="Nombre de la vista..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                marginBottom: 14,
                outline: 'none',
                fontSize: 13,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCurrentView}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
