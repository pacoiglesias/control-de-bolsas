import { useRef, type ReactNode } from 'react';

/**
 * Envuelve cualquier tablero Kanban horizontal con flechas visibles de
 * navegacion -- mas facil de descubrir que depender solo del scroll con
 * mouse/trackpad, que el usuario reporto como poco accesible.
 */
export function KanbanScrollWrapper({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => scrollBy(-320)}
          aria-label="Desplazar tablero a la izquierda"
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper-raised)', cursor: 'pointer', fontSize: 16 }}
        >◀</button>
        <button
          type="button"
          onClick={() => scrollBy(320)}
          aria-label="Desplazar tablero a la derecha"
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper-raised)', cursor: 'pointer', fontSize: 16 }}
        >▶</button>
      </div>
      <div ref={scrollRef} className="table-scroll" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        {children}
      </div>
    </div>
  );
}
