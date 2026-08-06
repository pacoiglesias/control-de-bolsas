import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const getGradient = () => {
    switch(tone) {
      case 'ok': return 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.2) 100%)';
      case 'bad': return 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.2) 100%)';
      case 'warn': return 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.2) 100%)';
      case 'cash': return 'linear-gradient(135deg, rgba(56,189,248,0.1) 0%, rgba(2,132,199,0.2) 100%)';
      default: return 'linear-gradient(135deg, rgba(30,41,59,0.4) 0%, rgba(15,23,42,0.6) 100%)';
    }
  };

  const getBorderColor = () => {
    switch(tone) {
      case 'ok': return 'rgba(16,185,129,0.3)';
      case 'bad': return 'rgba(239,68,68,0.3)';
      case 'warn': return 'rgba(245,158,11,0.3)';
      case 'cash': return 'rgba(56,189,248,0.3)';
      default: return 'rgba(255,255,255,0.1)';
    }
  };

  return (
    <motion.div
      className={`kpi-card ${hero ? 'hero' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      whileHover={onClick ? { y: -4, scale: 1.02, boxShadow: `0 10px 30px -10px ${getBorderColor()}` } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        background: getGradient(),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${getBorderColor()}`,
        borderRadius: '16px',
        padding: hero ? '24px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
    >
      <div style={{
        fontSize: hero ? '14px' : '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--ink-soft)',
        marginBottom: hero ? '8px' : '4px'
      }}>{label}</div>
      <div style={{
        fontSize: hero ? '32px' : '24px',
        fontWeight: 800,
        color: 'var(--ink)',
        letterSpacing: '-0.02em',
        lineHeight: 1.2
      }}>{value}</div>
      {sub ? <div style={{
        fontSize: '13px',
        color: 'var(--ink-faint)',
        marginTop: '8px',
        lineHeight: 1.4
      }}>{sub}</div> : null}
    </motion.div>
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
    <motion.section 
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.6)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        borderRadius: '20px',
        overflow: 'hidden'
      }}
    >
      {title || actions ? (
        <header className="card-head" style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.5)', padding: '20px 24px', background: 'rgba(248, 250, 252, 0.4)' }}>
          {title ? <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', margin: 0 }}>{title}</h3> : null}
          {hint ? <span className="hint" style={{ background: 'rgba(226, 232, 240, 0.5)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginLeft: 12 }}>{hint}</span> : null}
          <span className="spacer" style={{ flex: 1 }} />
          {actions}
        </header>
      ) : null}
      <div style={{ padding: '0' }}>
        {children}
      </div>
    </motion.section>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string; }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn-icon"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: 'auto', padding: '2px 6px', height: 24, fontSize: 11, color: copied ? 'var(--ok)' : 'var(--ink-soft)' }}
      title={`Copiar ${label ?? text}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? '✅' : '📋'}
      {label && <span style={{ fontWeight: 600 }}>{label}</span>}
    </button>
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
  // onClose casi siempre es una funcion nueva en cada render del padre. Antes
  // este efecto dependia de [onClose], asi que se reiniciaba en cada
  // render mientras el modal seguia abierto: cada reinicio quitaba el
  // bloqueo de scroll y lo volvia a poner. Si algo tronaba a mitad de una
  // interaccion (un error real de codigo, no solo un caso raro) ANTES de que
  // el efecto terminara de reiniciarse, la limpieza final podia no
  // ejecutarse nunca — el body se quedaba con overflow:hidden para
  // siempre, y el scroll dejaba de funcionar en TODA la aplicacion, no
  // solo en la pantalla donde paso. Con onCloseRef, el bloqueo se pone y se
  // quita UNA sola vez por apertura/cierre real del modal.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Quien abrio el modal recupera el foco al cerrarlo, y el fondo deja de
    // hacer scroll detras. Sin esto, con teclado se podia tabular hacia los
    // botones de la pantalla que quedaba tapada.
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    const paddingPrevio = document.body.style.paddingRight;
    // Sin esto, ocultar la barra de scroll del fondo (abajo) deja un hueco
    // del ancho exacto de esa barra -- el contenido de la pagina "salta"
    // unos pixeles hacia la derecha en el instante en que se abre el
    // expediente, y vuelve a saltar al cerrarlo. Compensar ese ancho con
    // padding evita el salto.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusables = () =>
      Array.from(
        boxRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
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
      document.body.style.paddingRight = paddingPrevio;
      previo?.focus?.();
    };
  }, []);

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
          className={`modal-box glass-modal ${wide ? 'wide' : ''}`} 
          ref={boxRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
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
      <span className="hide-desktop">{compactMoney(value)}</span>
    </>
  );
}

export function ProgressBar({ 
  current, 
  max, 
  color = 'var(--accent)' 
}: { 
  current: number, 
  max: number, 
  color?: string 
}) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
  return (
    <div style={{ width: '100%', height: 8, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ height: '100%', background: color, borderRadius: 4 }}
      />
    </div>
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

export function Dropdown({
  trigger,
  children,
  align = 'right'
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="dropdown-container" ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '100%',
              [align]: 0,
              marginTop: '8px',
              minWidth: '200px',
              background: 'var(--glass-bg, rgba(255, 255, 255, 0.85))',
              backdropFilter: 'blur(var(--blur-radius, 12px))',
              WebkitBackdropFilter: 'blur(var(--blur-radius, 12px))',
              border: '1px solid var(--glass-border, rgba(226, 232, 240, 0.6))',
              boxShadow: 'var(--glass-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
              borderRadius: '12px',
              zIndex: 50,
              padding: '8px 0',
              overflow: 'hidden'
            }}
            onClick={() => setIsOpen(false)} // Close on item click
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

