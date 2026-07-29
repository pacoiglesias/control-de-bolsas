import type { ReactNode } from 'react';
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from '../lib/types';

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
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
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

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
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
