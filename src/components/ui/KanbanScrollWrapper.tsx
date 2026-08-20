import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { playSoftClick, triggerHaptic } from '../../lib/hapticEngine';

/**
 * Envuelve cualquier tablero Kanban horizontal con flechas visibles de
 * navegación accesibles (mínimo 44x44px), detección de bordes de scroll
 * y desplazamiento fluido con aceleración táctil.
 */
export function KanbanScrollWrapper({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
    playSoftClick();
    triggerHaptic('light');
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => handleScroll(-340)}
          disabled={!canScrollLeft}
          aria-label="Desplazar tablero a la izquierda"
          title="Desplazar a la izquierda"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--paper-raised)',
            cursor: canScrollLeft ? 'pointer' : 'not-allowed',
            opacity: canScrollLeft ? 1 : 0.35,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            color: 'var(--ink)',
          }}
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() => handleScroll(340)}
          disabled={!canScrollRight}
          aria-label="Desplazar tablero a la derecha"
          title="Desplazar a la derecha"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--paper-raised)',
            cursor: canScrollRight ? 'pointer' : 'not-allowed',
            opacity: canScrollRight ? 1 : 0.35,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            color: 'var(--ink)',
          }}
        >
          ▶
        </button>
      </div>
      <div
        ref={scrollRef}
        className="table-scroll"
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          paddingBottom: 16,
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  );
}
