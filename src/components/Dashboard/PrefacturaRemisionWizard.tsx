/**
 * PrefacturaRemisionWizard.tsx
 * Wizard interactivo para dividir la Remisión 114400 en múltiples prefacturas.
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { money } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

const PRICE_PER_KG = 44.00;
const IVA_RATE     = 0.16;
const STORAGE_KEY  = 'rem114400_wizard_state_v1';

interface RemItem {
  code:        string;
  description: string;
  qtyTotal:    number;
}

const REMISION_ITEMS: RemItem[] = [
  { code: 'egbo000107-sc', description: 'BOLSA POLIETILENO 48+17+17x140 CM CAL 250',  qtyTotal:  978.96 },
  { code: 'enbo000167-bl', description: 'BOLSA POLIETILENO 55 CM X 126 CM Blanco',     qtyTotal: 1000.00 },
  { code: 'egbo000103-sc', description: 'BULTO 80+20+20x160 CM CAL 250',               qtyTotal:  987.28 },
  { code: 'EGBO000101-SC', description: 'BULTO 60+20x120 CM CAL 250',                  qtyTotal:  500.00 },
  { code: 'enbo000084-sc', description: 'BOLSA POLIETILENO 55 CM x 55 CM',             qtyTotal: 1000.00 },
  { code: 'enbo000006-sc', description: 'BOLSA POLIETILENO 77 CM X 55 CM (55x77)',     qtyTotal:  839.52 },
  { code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM (50x55)',     qtyTotal: 1500.00 },
];

const TOTAL_KG_REMISION = REMISION_ITEMS.reduce((s, it) => s + it.qtyTotal, 0);

function r2(n: number) { return Math.round(n * 100) / 100; }
function fmtKg(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function loadState(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveState(s: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

async function generatePartialPdf(
  items: Array<{ code: string; description: string; qty: number }>,
  partLabel: string,
  totalKgRemision: number,
  kgYaFacturados: number,
) {
  const html2pdf = (await import('html2pdf.js')).default;
  const totalKg  = r2(items.reduce((s, it) => s + it.qty, 0));
  const subtotal = r2(totalKg * PRICE_PER_KG);
  const ivaAmt   = r2(subtotal * IVA_RATE);
  const total    = r2(subtotal + ivaAmt);
  const kgPend   = r2(Math.max(0, totalKgRemision - kgYaFacturados - totalKg));

  const rows = items.map((it, idx) => {
    const imp = r2(it.qty * PRICE_PER_KG);
    const bg  = idx % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="border-bottom:1px solid #e2e8f0;background:${bg};">
      <td style="padding:7px 10px;font-size:10px;color:#64748b;font-family:monospace;">24141500</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:700;font-family:monospace;">${fmtKg(it.qty)}</td>
      <td style="padding:7px 10px;font-size:10px;color:#475569;">KGM</td>
      <td style="padding:7px 10px;font-size:11px;"><span style="font-family:monospace;color:#2563eb;font-size:10px;font-weight:800;">${it.code.toUpperCase()}</span><br/>${it.description}</td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:11px;">$${PRICE_PER_KG.toFixed(2)}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:800;font-family:monospace;font-size:11px;color:#047857;">$${imp.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
    </tr>`;
  }).join('');

  const html = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:24px 32px;color:#1e293b;background:#fff;max-width:820px;margin:0 auto;font-size:12px;line-height:1.4;">
    <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);color:#fff;border-radius:10px;padding:10px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:22px;">⚡</span>
      <div>
        <div style="font-size:13px;font-weight:900;">REMISION 114400 · PARTE ${partLabel} — PENDIENTE DE TIMBRAR</div>
        <div style="font-size:11px;opacity:0.88;">OC 71/14400 · TH Nava · ${fmtKg(totalKg)} kg esta parte · Ya facturados: ${fmtKg(kgYaFacturados)} kg · Pendiente: ${fmtKg(kgPend)} kg</div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div style="font-size:18px;font-weight:900;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        <div style="font-size:10px;opacity:0.8;">TOTAL CON IVA</div>
      </div>
    </div>
    <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;margin-bottom:18px;border-left:4px solid #f59e0b;font-size:11px;color:#334155;">
      <strong>Progreso Remision 114400:</strong> Facturado antes: <strong>${fmtKg(kgYaFacturados)} kg</strong> | Esta parte: <strong style="color:#2563eb;">${fmtKg(totalKg)} kg</strong> | Pendiente restante: <strong style="color:${kgPend > 0 ? '#dc2626' : '#059669'};">${fmtKg(kgPend)} kg</strong> | Total: <strong>${fmtKg(totalKgRemision)} kg</strong>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px;">
      <div>
        <div style="font-size:20px;font-weight:900;color:#0f172a;">ELEMENTAL DENIM</div>
        <div style="font-size:12px;font-weight:800;color:#2563eb;">RFC: EDE1902136T2</div>
        <div style="font-size:10.5px;color:#334155;margin-top:4px;">Regimen: 601 - General de Ley PM · Zavaleta 1108/1701, Santa Cruz Buenavista, CP 72150, Puebla</div>
      </div>
      <div style="text-align:right;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 16px;min-width:220px;">
        <div style="font-size:10px;font-weight:800;color:#2563eb;text-transform:uppercase;">PREFACTURA PARCIAL / CFDI 4.0</div>
        <div style="font-size:15px;font-weight:900;color:#0f172a;">PARTE ${partLabel}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;">Remision: <strong>114400</strong> · OC: <strong>120267114400 (71/14400)</strong></div>
        <div style="font-size:10px;color:#475569;">Fecha: 27 de Octubre de 2026</div>
        <div style="font-size:10px;color:#dc2626;font-weight:800;margin-top:4px;">Ahmed Flores Grande (firmante)</div>
      </div>
    </div>
    <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin-bottom:18px;border-left:4px solid #2563eb;">
      <div style="font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:6px;">Receptor:</div>
      <div style="font-size:13px;font-weight:800;color:#0f172a;">GRUPO TEXTIL PROVIDENCIA SA DE CV</div>
      <div style="font-size:10.5px;color:#475569;margin-top:2px;">HIDALGO NORTE 7, CP 90800, STA ANA CHIAUTEMPAN, TLAXCALA</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font-size:10.5px;">
        <div><strong>RFC:</strong> GTP930115PU1</div><div><strong>Uso CFDI:</strong> G01 - Adquisicion de mercancias</div>
        <div><strong>Metodo Pago:</strong> PPD - Diferido</div><div><strong>Almacen:</strong> Almacen 1 (TH · Nava)</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <thead><tr style="background:#1e293b;color:#fff;font-size:9.5px;text-transform:uppercase;">
        <th style="padding:8px 10px;text-align:left;">Clave SAT</th>
        <th style="padding:8px 10px;text-align:right;">Cant. (Kg)</th>
        <th style="padding:8px 10px;text-align:left;">Unidad</th>
        <th style="padding:8px 10px;text-align:left;">Codigo / Descripcion</th>
        <th style="padding:8px 10px;text-align:right;">P. Unit.</th>
        <th style="padding:8px 10px;text-align:right;">Importe</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f1f5f9;font-size:12px;font-weight:800;">
        <td colspan="2" style="padding:10px;color:#2563eb;">TOTAL: ${fmtKg(totalKg)} kg</td>
        <td colspan="2" style="padding:10px;color:#475569;font-size:11px;">Parte ${partLabel} de Remision 114400</td>
        <td style="padding:10px;text-align:right;color:#475569;">Subtotal:</td>
        <td style="padding:10px;text-align:right;font-family:monospace;color:#047857;">$${subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      </tr></tfoot>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
      <div style="min-width:260px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:14px 18px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;"><span style="color:#475569;">SUBTOTAL:</span><span style="font-family:monospace;font-weight:700;">$${subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;"><span style="color:#2563eb;font-weight:700;">I.V.A. (16%):</span><span style="font-family:monospace;font-weight:700;color:#2563eb;">+$${ivaAmt.toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:900;"><span>TOTAL:</span><span style="color:#047857;font-family:monospace;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>
        <div style="font-size:10px;color:#64748b;margin-top:6px;text-align:right;">${fmtKg(totalKg)} kg x $${PRICE_PER_KG.toFixed(2)}/kg + IVA 16%</div>
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:10px;color:#64748b;">
      Clave SAT: 24141500 · Unidad: KGM · Obj. Impuesto: 02 · RFC Receptor: GTP930115PU1<br/>
      AVISO: Este es un documento de referencia. El CFDI oficial debe timbrase en el portal del SAT. · REM: 114400 · OC: 120267114400
    </div>
  </div>`;

  const opt: any = {
    margin: [8, 10, 8, 10],
    filename: `Prefactura_REM114400_Parte${partLabel}_${fmtKg(totalKg)}kg.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
  };
  await html2pdf().set(opt).from(html).save();
}

interface Props { onClose: () => void; }

export function PrefacturaRemisionWizard({ onClose }: Props) {
  const toast = useToast();
  const [alreadyInvoiced, setAlreadyInvoiced] = useState<Record<string, number>>(loadState);
  const [nowValues, setNowValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  const rows = useMemo(() => REMISION_ITEMS.map(it => {
    const prevInvoiced = r2(alreadyInvoiced[it.code] || 0);
    const available    = r2(it.qtyTotal - prevInvoiced);
    const rawNow       = parseFloat(nowValues[it.code] || '0');
    const nowQty       = isNaN(rawNow) ? 0 : Math.min(Math.max(0, rawNow), available);
    const remaining    = r2(available - nowQty);
    const importe      = r2(nowQty * PRICE_PER_KG);
    return { ...it, prevInvoiced, available, nowQty, remaining, importe };
  }), [alreadyInvoiced, nowValues]);

  const totals = useMemo(() => {
    const kgYaFacturados = r2(Object.values(alreadyInvoiced).reduce((s, v) => s + v, 0));
    const kgEstaParte    = r2(rows.reduce((s, r) => s + r.nowQty, 0));
    const subtotal       = r2(kgEstaParte * PRICE_PER_KG);
    const iva            = r2(subtotal * IVA_RATE);
    const total          = r2(subtotal + iva);
    const kgPendiente    = r2(TOTAL_KG_REMISION - kgYaFacturados - kgEstaParte);
    const pctFacturado   = TOTAL_KG_REMISION > 0 ? ((kgYaFacturados + kgEstaParte) / TOTAL_KG_REMISION) * 100 : 0;
    const partNum        = Object.values(alreadyInvoiced).some(v => v > 0) ? 2 : 1;
    return { kgYaFacturados, kgEstaParte, subtotal, iva, total, kgPendiente, pctFacturado, partLabel: String(partNum) };
  }, [rows, alreadyInvoiced]);

  const handleNowChange = useCallback((code: string, value: string) => {
    setNowValues(prev => ({ ...prev, [code]: value }));
  }, []);

  const handleFillAll = useCallback((code: string) => {
    const row = rows.find(r => r.code === code);
    if (row) setNowValues(prev => ({ ...prev, [code]: String(row.available) }));
  }, [rows]);

  const handleClearRow = useCallback((code: string) => {
    setNowValues(prev => ({ ...prev, [code]: '0' }));
  }, []);

  const handleGeneratePdf = async () => {
    const itemsToInvoice = rows.filter(r => r.nowQty > 0).map(r => ({ code: r.code, description: r.description, qty: r.nowQty }));
    if (itemsToInvoice.length === 0) { toast('Ingresa al menos un renglon con kilos a facturar.', 'bad'); return; }
    setGenerating(true);
    try {
      await generatePartialPdf(itemsToInvoice, totals.partLabel, TOTAL_KG_REMISION, totals.kgYaFacturados);
      toast(`Prefactura Parte ${totals.partLabel} generada (${fmtKg(totals.kgEstaParte)} kg)`, 'ok');
    } catch (err: any) { toast('Error PDF: ' + err.message, 'bad'); }
    finally { setGenerating(false); }
  };

  const handleConfirmInvoiced = () => {
    const items = rows.filter(r => r.nowQty > 0);
    if (items.length === 0) { toast('No hay kilos marcados para confirmar.', 'bad'); return; }
    const next = { ...alreadyInvoiced };
    items.forEach(r => { next[r.code] = r2((next[r.code] || 0) + r.nowQty); });
    setAlreadyInvoiced(next); saveState(next); setNowValues({});
    toast(`${fmtKg(totals.kgEstaParte)} kg confirmados. Restante: ${fmtKg(Math.max(0, totals.kgPendiente))} kg`, 'ok');
  };

  const handleReset = () => { setAlreadyInvoiced({}); setNowValues({}); saveState({}); toast('Estado reiniciado. Todos los kg marcados como pendientes.', 'ok'); };

  const allFacturado = totals.kgYaFacturados >= TOTAL_KG_REMISION - 0.01;

  const S: React.CSSProperties = {
    position: 'fixed', inset: '0', zIndex: 9000,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '16px', overflowY: 'auto',
  };

  return (
    <div style={S} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--paper, #fff)', borderRadius: 18, boxShadow: '0 24px 80px -8px rgba(0,0,0,0.45)', width: '100%', maxWidth: 900, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}
      >
        {/* HEADER */}
        <div style={{ background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📋</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Facturación Parcial — Remisión 114400</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>OC 71/14400 · Textil Hogar · Ahmed Flores Grande · 27/Oct/2026</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕ Cerrar</button>
        </div>

        {/* BARRA DE PROGRESO */}
        <div style={{ padding: '14px 24px', background: 'var(--paper-sunk, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {([
                ['Total Remisión', fmtKg(TOTAL_KG_REMISION) + ' kg', 'var(--ink, #0f172a)', false],
                ['Ya Facturado', fmtKg(totals.kgYaFacturados) + ' kg', '#059669', false],
                ['Esta Parte', fmtKg(totals.kgEstaParte) + ' kg', '#2563eb', true],
                ['Resta Después', fmtKg(Math.max(0, totals.kgPendiente)) + ' kg', totals.kgPendiente > 0 ? '#dc2626' : '#059669', false],
              ] as [string, string, string, boolean][]).map(([label, val, color, bold]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: bold ? 900 : 800, fontFamily: 'monospace', color }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#2563eb' }}>{totals.pctFacturado.toFixed(1)}% facturado</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft, #64748b)' }}>de {fmtKg(TOTAL_KG_REMISION)} kg totales</div>
            </div>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 8, background: '#10b981', width: `${Math.min(100, (totals.kgYaFacturados / TOTAL_KG_REMISION) * 100)}%`, transition: 'width 0.4s ease' }} />
            <div style={{ position: 'absolute', top: 0, left: `${Math.min(100, (totals.kgYaFacturados / TOTAL_KG_REMISION) * 100)}%`, height: '100%', background: '#3b82f6', width: `${Math.min(100 - (totals.kgYaFacturados / TOTAL_KG_REMISION) * 100, (totals.kgEstaParte / TOTAL_KG_REMISION) * 100)}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 10, color: 'var(--ink-soft, #64748b)' }}>
            {([['#10b981', 'Facturado antes'], ['#3b82f6', 'Esta parte'], ['#e2e8f0', 'Pendiente']] as [string, string][]).map(([bg, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: bg, display: 'inline-block' }} />{label}</span>
            ))}
          </div>
        </div>

        {/* TABLA */}
        <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
          {allFacturado && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid #10b981', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>Remisión 114400 completamente facturada</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft, #64748b)', marginTop: 2 }}>Los {fmtKg(TOTAL_KG_REMISION)} kg han sido confirmados. Reinicia el estado si necesitas corregir algo.</div>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#fff' }}>
                {['Código / Producto', 'Total Rem.', 'Ya Fact.', 'Disponible', '⚡ A Facturar Ahora', 'Restante', 'Importe'].map((h, i) => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: i === 4 ? '#1d4ed8' : undefined, minWidth: i === 4 ? 130 : undefined, borderRadius: i === 0 ? '6px 0 0 0' : i === 6 ? '0 6px 0 0' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isComplete = row.prevInvoiced >= row.qtyTotal - 0.01;
                const bg = idx % 2 === 0 ? 'var(--paper, #fff)' : 'var(--paper-sunk, #f8fafc)';
                return (
                  <tr key={row.code} style={{ background: bg, borderBottom: '1px solid var(--line, #e2e8f0)', opacity: row.available <= 0.01 ? 0.5 : 1 }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 800, color: '#2563eb' }}>{row.code.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink, #1e293b)', marginTop: 2, maxWidth: 240, lineHeight: 1.3 }}>{row.description}</div>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{fmtKg(row.qtyTotal)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: row.prevInvoiced > 0 ? '#059669' : 'var(--ink-soft, #94a3b8)' }}>{fmtKg(row.prevInvoiced)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: row.available > 0 ? '#0f172a' : '#94a3b8' }}>{fmtKg(row.available)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {isComplete ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>✅ Completo</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <input type="number" min={0} max={row.available} step={0.01}
                            value={nowValues[row.code] ?? ''} placeholder={fmtKg(row.available)}
                            onChange={e => handleNowChange(row.code, e.target.value)}
                            style={{ width: 88, padding: '5px 8px', borderRadius: 7, border: '2px solid #3b82f6', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#1e40af', outline: 'none', background: 'rgba(59,130,246,0.06)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button onClick={() => handleFillAll(row.code)} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}>Todo</button>
                            <button onClick={() => handleClearRow(row.code)} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 700 }}>×</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: row.remaining > 0.01 ? '#dc2626' : '#059669' }}>{fmtKg(Math.max(0, row.remaining))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#047857' }}>{row.nowQty > 0 ? `$${row.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTALES Y ACCIONES */}
        <div style={{ padding: '16px 24px 20px', background: 'var(--paper-sunk, #f8fafc)', borderTop: '1.5px solid var(--line, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Esta Parte</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#2563eb' }}>{fmtKg(totals.kgEstaParte)} kg</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--ink-soft, #64748b)' }}>Subtotal:</span><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{money(totals.subtotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#2563eb', fontWeight: 700 }}>IVA 16%:</span><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>+{money(totals.iva)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, borderTop: '1px solid var(--line, #e2e8f0)', paddingTop: 4, marginTop: 2 }}>
                <span>TOTAL:</span><span style={{ fontFamily: 'monospace', color: '#047857' }}>{money(totals.total)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={handleReset} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid var(--line, #e2e8f0)', color: 'var(--ink-soft, #64748b)' }}>🔄 Reiniciar</button>
            <button onClick={handleGeneratePdf} disabled={generating || totals.kgEstaParte <= 0}
              style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: totals.kgEstaParte > 0 ? 'pointer' : 'not-allowed', background: totals.kgEstaParte > 0 ? 'linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)' : '#cbd5e1', color: '#fff', border: 'none', boxShadow: totals.kgEstaParte > 0 ? '0 4px 14px rgba(37,99,235,0.35)' : 'none', opacity: generating ? 0.7 : 1, transition: 'all 0.2s' }}>
              {generating ? '⏳ Generando...' : `📄 PDF Parte ${totals.partLabel}`}
            </button>
            <button onClick={handleConfirmInvoiced} disabled={totals.kgEstaParte <= 0}
              style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: totals.kgEstaParte > 0 ? 'pointer' : 'not-allowed', background: totals.kgEstaParte > 0 ? 'linear-gradient(135deg,#059669 0%,#047857 100%)' : '#cbd5e1', color: '#fff', border: 'none', boxShadow: totals.kgEstaParte > 0 ? '0 4px 14px rgba(5,150,105,0.35)' : 'none', transition: 'all 0.2s' }}>
              ✅ Confirmar Facturados
            </button>
          </div>
        </div>
        <div style={{ padding: '8px 24px 12px', fontSize: 10, color: 'var(--ink-soft, #64748b)', background: 'var(--paper-sunk, #f8fafc)', borderTop: '1px solid var(--line, #e2e8f0)' }}>
          💡 <strong>Flujo:</strong> (1) Ingresa kg por renglon → (2) Genera PDF → (3) Confirma facturados para avanzar a la siguiente parte. El estado se guarda entre sesiones.
        </div>
      </motion.div>
    </div>
  );
}
