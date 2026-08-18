import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { toDate } from '../lib/format';

/**
 * Aviso de facturas recien vencidas, visible al abrir CUALQUIER pantalla.
 *
 * No existe servicio de correo/WhatsApp conectado (ver el comentario en
 * functions/src/index.ts, checkOverdueInvoices) -- montar uno real requiere
 * credenciales SMTP o de un proveedor que el usuario tiene que dar de alta
 * el mismo. Mientras tanto, checkOverdueInvoices ya escribe un renglon en
 * system_logs cada noche con los folios que cruzaron a vencido; antes esa
 * info solo se veia entrando manualmente a /logs. Este banner la sube a la
 * superficie de inmediato, sin tener que ir a buscarla.
 */
export function OverdueBanner() {
  const nav = useNavigate();
  const [aviso, setAviso] = useState<{ id: string; cantidad: number; folios: string[]; timestamp: Timestamp | null } | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(() => localStorage.getItem('cb-overdue-banner-dismissed'));

  useEffect(() => {
    const q = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const hit = snap.docs.find((d) => d.data().action === 'Facturas Vencidas (automático)');
      if (!hit) { setAviso(null); return; }
      const data = hit.data();
      const ts: Timestamp | null = data.timestamp ?? null;
      // Solo interesa si paso en las ultimas 48h -- un aviso de hace dos
      // semanas ya no aporta nada y solo estorbaria en pantalla.
      const tsMs = toDate(ts)?.getTime() || 0;
      if (tsMs > 0 && Date.now() - tsMs > 48 * 60 * 60 * 1000) { setAviso(null); return; }
      setAviso({
        id: hit.id,
        cantidad: data.details?.cantidad ?? 0,
        folios: data.details?.folios ?? [],
        timestamp: ts,
      });
    });
    return () => unsub();
  }, []);

  if (!aviso || aviso.cantidad === 0 || aviso.id === dismissedId) return null;

  const dismiss = () => {
    localStorage.setItem('cb-overdue-banner-dismissed', aviso.id);
    setDismissedId(aviso.id);
  };

  const listaFolios = aviso.folios.slice(0, 5).join(', ') + (aviso.folios.length > 5 ? `, +${aviso.folios.length - 5} más` : '');

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: 'var(--bad-bg, #fef2f2)', border: '1px solid var(--bad)',
        color: 'var(--bad)', borderRadius: 'var(--radius)', padding: '10px 16px',
        margin: '0 0 16px 0', fontSize: 13, fontWeight: 600,
      }}
    >
      <span>🔴 {aviso.cantidad} factura{aviso.cantidad === 1 ? '' : 's'} se venci{aviso.cantidad === 1 ? 'ó' : 'eron'} recientemente{listaFolios ? `: ${listaFolios}` : ''}.</span>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          className="btn"
          style={{ background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)', padding: '4px 10px', fontSize: 12 }}
          onClick={() => nav('/ordenes?filtro=overdue')}
        >
          Ver vencidas
        </button>
        <button
          className="btn"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={dismiss}
        >
          Ya lo vi
        </button>
      </div>
    </div>
  );
}
