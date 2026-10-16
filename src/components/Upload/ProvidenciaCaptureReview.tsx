import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useOrdersContext } from '../../context/OrdersContext';
import { evidenceRequirements, type ProvidenciaEvidence } from '../../lib/providenciaEvidence';
import { money } from '../../lib/format';
import { buildReceivables } from '../../lib/receivables';
import './captureReview.css';

export function EvidenceRows({ evidence: e }: { evidence: ProvidenciaEvidence }) {
  return <div style={{overflowX:'auto',maxHeight:420}}>
    <p>{e.title} · {e.receipts.length || e.invoices.length || e.allocations.length} registros · {money(e.total)}{e.kind==='payment_rep' ? ` · Fecha de pago: ${e.paymentDate} · REP ${e.folio}` : ''}</p>
    {e.partial && <p role="note">Solo se recibió una parte del listado. Faltan páginas del portal.</p>}
    {e.receipts.length>0 && <table className="table"><thead><tr><th>Contrarrecibo</th><th>Fecha</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody>{e.receipts.map(r=><tr key={r.cr}><td>{r.cr}</td><td>{r.issueDate}</td><td>{r.dueDate}</td><td>{money(r.total)}</td><td>{money(r.paid)}</td><td>{money(r.remaining)}</td><td>{r.status}</td></tr>)}</tbody></table>}
    {e.invoices.length>0 && <table className="table"><thead><tr><th>Factura</th><th>OC</th><th>Emisión</th><th>Total</th></tr></thead><tbody>{e.invoices.map(r=><tr key={r.folio}><td>{r.folio}</td><td>{r.oc}</td><td>{r.issueDate.split('T')[0]}</td><td>{money(r.total)}</td></tr>)}</tbody></table>}
    {e.allocations.length>0 && <table className="table"><thead><tr><th>Factura</th><th>UUID relacionado</th><th>Saldo anterior</th><th>Pagado</th><th>Saldo restante</th></tr></thead><tbody>{e.allocations.map(r=><tr key={r.uuid||r.folio}><td>{r.folio}</td><td style={{maxWidth:240,overflowWrap:'anywhere'}}>{r.uuid}</td><td>{money(r.previous)}</td><td>{money(r.paid)}</td><td>{money(r.remaining)}</td></tr>)}</tbody></table>}
  </div>;
}

export function ProvidenciaCaptureReview({ compact=false }: { compact?: boolean }) {
  const { role }=useAuth();
  const { documentOrders, orders }=useOrdersContext();
  const [records,setRecords]=useState<Array<{id:string;fileName:string;evidence:ProvidenciaEvidence;reconciliation?:{applied:boolean}}>>([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(role!=='admin' && role!=='manager') return;
    return onSnapshot(query(collection(db,'storedDocuments'),where('evidence.kind','in',['receipt_list','invoice_list','payment_rep'])),snap=>{
      setRecords(snap.docs.map(d=>({...d.data(),id:d.id} as typeof records[number])));setError('');
    },()=>setError('No se pudieron consultar los documentos pendientes. Vuelve a abrir Documentos.'));
  },[role]);
  if(role!=='admin' && role!=='manager') return null;
  if(!records.length && !error) return null;
  const allOrders=documentOrders||orders;
  const details=records.map(r=>({...r,requirements:evidenceRequirements(r.evidence,allOrders)}));
  const missing=[...new Set(details.flatMap(r=>r.requirements))];
  const folios=new Set(records.flatMap(r=>r.evidence.invoices.map(i=>i.folio)));
  const related=allOrders.map(o=>({...o,invoices:(o.invoices||[]).filter(i=>folios.has(i.folio||''))}));
  const totals=buildReceivables(related);
  const applied=records.every(r=>r.reconciliation?.applied);
  const fiscal=totals.rows.filter(r=>!r.invoice.uuid || (r.invoice as any).quantityPending);
  return <section className="capture-review" aria-label="Documentos aplicados y siguientes pasos">
    <span className="work-eyebrow">Tus documentos, en seguimiento</span>
    <h2>{applied?'Documentos aplicados a tus cuentas':'Revisar documentos recibidos'}</h2>
    {error && <p role="alert">{error}</p>}
    <p className="work-muted">{records.length} documentos recibidos · {totals.rows.length} facturas vinculadas al panel. Los faltantes se actualizan al capturar nuevos documentos.</p>
    {applied && <span className="capture-state">Conciliación aplicada · originales conservados</span>}
    {totals.rows.length>0 && <div className="work-stats"><div><small>Facturado en el panel recibido</small><strong>{money(totals.invoiced)}</strong></div><div><small>Pagado por el cliente</small><strong>{money(totals.paid)}</strong></div><div><small>Saldo pendiente de cobro</small><strong>{money(totals.total)}</strong></div></div>}
    <div className="work-callout"><strong>Tu siguiente paso</strong><p>{fiscal.length?`Completa XML o PDF de ${fiscal.length} facturas para comprobar UUID, conceptos y kilos. Los importes del portal ya están registrados; no vuelvas a capturarlos como ventas nuevas.`:missing[0]||'Revisa los comprobantes de ingreso y las páginas restantes del portal para completar el expediente.'}</p></div>
    <nav className="work-actions" aria-label="Continuar captura"><Link className="btn" to="/cobranza">Revisar cobranza →</Link>{compact && <Link className="btn" to="/archivo-documentos">Completar documentos →</Link>}</nav>
    {!compact && <>
    <p className="work-muted">Los vínculos de contrarrecibos se conciliaron por departamento, fechas y suma exacta. Conserva el detalle individual de cada contrarrecibo para comprobar qué facturas ampara. Las páginas recibidas no cubren todo el historial del portal.</p>
    {fiscal.length>0 && <details><summary>Completar datos fiscales · {fiscal.length} facturas</summary><p className="work-muted">Arrastra el XML o PDF individual. Se debe vincular a la factura existente por su folio y UUID.</p><ul>{fiscal.map(r=><li key={r.key}>Factura {r.invoice.folio} · OC {r.order.oc} · {!r.invoice.uuid?'falta UUID. ':''}{(r.invoice as any).quantityPending?'Faltan conceptos y kilos.':''}</li>)}</ul></details>}
    <details><summary>Revisar faltantes y diferencias · {missing.length}</summary>{missing.length?<ul>{missing.map(s=><li key={s}>{s}</li>)}</ul>:<p>Sin diferencias con las páginas recibidas.</p>}</details>
    {details.map(r=><details key={r.id}>
      <summary>{r.evidence.title}{r.evidence.folio ? ` ${r.evidence.folio}` : ''} · {r.reconciliation?.applied?'Aplicado':'Pendiente de aplicar'}</summary>
      <p className="hint">{r.fileName}</p>
      <EvidenceRows evidence={r.evidence}/>
      {r.requirements.length ? <><h3 style={{fontSize:15}}>Qué falta para conciliar</h3><ul>{r.requirements.map(s=><li key={s} style={{marginBottom:7}}>{s}</li>)}</ul></> : <p>Sin diferencias detectadas con los datos capturados.</p>}
    </details>)}
    </>}
  </section>;
}
