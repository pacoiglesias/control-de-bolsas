import { useEffect, useRef, type ReactNode } from 'react';
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from '../lib/types';
import { money, kilos, compactMoney, compactKilos } from '../lib/format';
import { useConfig } from '../hooks/useConfig';
import { motion, AnimatePresence } from 'framer-motion';

export function KpiCard({
  label,
  value,
  sub,
  tone,
  hero,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'ok' | 'bad' | 'warn' | 'cash';
  hero?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`kpi-card ${tone ?? ''} ${hero ? 'hero' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Card({
  title,
  actions,
  children,
  hint,
}: {
  title?: string;
  actions?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {title || actions ? (
        <header className="card-head">
          {title ? <h3>{title}</h3> : null}
          {hint ? <span className="hint">{hint}</span> : null}
          <span className="spacer" />
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Quien abrio el modal recupera el foco al cerrarlo, y el fondo deja de
    // hacer scroll detras. Sin esto, con teclado se podia tabular hacia los
    // botones de la pantalla que quedaba tapada.
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        boxRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const lista = focusables();
        if (lista.length === 0) return;
        const primero = lista[0];
        const ultimo = lista[lista.length - 1];
        if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        } else if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.();
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <motion.div 
          className="modal-scrim" 
          onClick={onClose} 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div 
          className={`modal-box ${wide ? 'wide' : ''}`} 
          ref={boxRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="modal-head">
            <h2 id="modal-title">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar modal">
              ✖
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children, icon }: { children: ReactNode; icon?: string }) {
  return (
    <div className="empty">
      {icon ? <span className="empty-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="empty">
      <span className="spinner" aria-hidden="true" /> {label ?? 'Cargando…'}
    </div>
  );
}

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function ResponsiveMoney({ value }: { value: number }) {
  return (
    <>
      <span className="hide-mobile">{money(value)}</span>
      <span className="show-mobile" title={money(value)}>{compactMoney(value)}</span>
    </>
  );
}

export function ResponsiveKilos({ value }: { value: number }) {
  return (
    <>
      <span className="hide-mobile">{kilos(value)}</span>
      <span className="show-mobile" title={kilos(value)}>{compactKilos(value)}</span>
    </>
  );
}

export function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { config } = useConfig();
  const date = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="print-header only-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        {config.companyLogoUrl ? (
          <img src={config.companyLogoUrl} alt="Logo" style={{ width: 100, height: 100, objectFit: 'contain' }} />
        ) : null}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {config.companyName || 'Bolsas Elemental'}
          </h2>
          <div style={{ fontSize: 16, color: '#475569', fontWeight: 600, marginTop: 4 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', alignSelf: 'flex-start' }}>
          Documento generado el:<br />
          <strong>{date}</strong>
        </div>
      </div>
    </div>
  );
}
