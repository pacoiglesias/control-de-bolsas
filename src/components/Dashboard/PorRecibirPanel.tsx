import { money } from '../../lib/format';

// Extraido de Dashboard.tsx (era una funcion local `renderPorRecibirPanel`,
// ~100 lineas): panel que lista las facturas ya cobradas por el cliente
// pero que el contador todavia no entrega en efectivo. Componente puramente
// presentacional -- solo recibe datos y un callback, sin logica de
// Firestore propia (esa sigue viviendo en Dashboard.tsx como handleRecibir).

interface PorRecibirItem {
  orderId: string;
  invoiceId: string;
  folio: string;
  cr: string;
  invoiceTotal: number;
  commission: number;
  net: number;
}

interface PorRecibirPanelProps {
  porRecibir: PorRecibirItem[];
  totalPorRecibir: number;
  onRecibir: (r: PorRecibirItem) => void;
}

export function PorRecibirPanel({ porRecibir, totalPorRecibir, onRecibir }: PorRecibirPanelProps) {
  if (porRecibir.length === 0) return null;
  const totalBruto = porRecibir.reduce((acc, r) => acc + r.invoiceTotal, 0);
  const totalComision = porRecibir.reduce((acc, r) => acc + r.commission, 0);
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 16,
        padding: 22,
        marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
          💼 Por Recibir del Contador ({porRecibir.length})
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
          Facturas cobradas por el cliente donde el contador aún tiene pendiente entregar el efectivo.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          background: 'var(--paper-raised)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 14,
          border: '1px solid var(--line-soft)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
            Cobrado Cliente
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{money(totalBruto)}</div>
        </div>
        <div style={{ fontSize: 18, color: 'var(--ink-soft)' }}>−</div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
            Comisión 8%
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{money(totalComision)}</div>
        </div>
        <div style={{ fontSize: 18, color: 'var(--ink-soft)' }}>=</div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
            Neto a Caja
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>{money(totalPorRecibir)}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>Factura</th>
            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>CR</th>
            <th style={{ padding: '6px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Importe</th>
            <th style={{ padding: '6px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Neto</th>
            <th style={{ padding: '6px', textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {porRecibir.map((r, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontWeight: 700 }}>#{r.folio}</td>
              <td style={{ padding: '8px 6px', color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{r.cr}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{money(r.invoiceTotal)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--ok)', fontWeight: 800 }}>{money(r.net)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                <button
                  className="btn"
                  style={{
                    background: 'var(--ok-bg)',
                    color: 'var(--ok)',
                    border: '1px solid var(--ok)',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  onClick={() => onRecibir(r)}
                >
                  💵 Recibir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
