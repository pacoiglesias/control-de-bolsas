import type {AndresBalanceConfig} from '../../../functions/src/shared/finance.core';
import {money} from '../../lib/format';

export function SupplierStatementReview({source,dark=false}:{source:AndresBalanceConfig['providerStatement'];dark?:boolean}){
  if(!source)return null;
  const warnings=source.warnings||[];
  return <section aria-label="Conciliación del estado del proveedor" style={{padding:20,borderRadius:16,border:'1px solid '+(dark?'#66522a':'#e6c679'),background:dark?'rgba(120,87,20,.17)':'#fffcf3',color:dark?'#f9e8b7':'#503c11',marginBottom:20}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
      <div><strong>Estado del proveedor · corte {source.asOf.split('-').reverse().join('/')}</strong><p style={{margin:'6px 0 14px',fontSize:13}}>Saldo según el documento: <strong>{money(source.closingSupplierBalance)}</strong> {source.closingSupplierBalance>=0?'por pagar a Andrés':'de anticipo disponible'}.</p></div>
      <a className="btn" href="/archivo-documentos">Ver documentos originales</a>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,fontSize:13}}>
      <div>Saldo anterior<br/><strong>{money(source.openingSupplierBalance)}</strong></div>
      <div>Cargos del periodo<br/><strong>{money(source.totalDeliveries||0)}</strong></div>
      <div>Pagos del periodo<br/><strong>{money(source.totalPayments||0)}</strong></div>
      <div>Kilos reportados<br/><strong>{(source.totalKilos||0).toLocaleString('es-MX',{maximumFractionDigits:2})} kg</strong></div>
    </div>
    <p style={{fontSize:12,marginBottom:8}}>Los pagos de este estado forman parte de la cuenta del proveedor. Sus comprobantes bancarios y la caja se concilian por separado.</p>
    {Boolean(source.arithmeticDifference)&&<p style={{fontSize:13,fontWeight:700}}>Por comprobar: {money(source.arithmeticDifference||0)} de diferencia entre kilos × precio y cargos impresos. Se conserva el saldo reportado mientras se aclara.</p>}
    <p style={{fontSize:12}}>{source.referenceCorrections||0} referencias de OC corregidas · {source.quantityDifferences||0} diferencias de peso · {source.unmatchedRemissions||0} remisiones originales pendientes de aportar.</p>
    {warnings.length>0&&<details><summary style={{cursor:'pointer',fontWeight:750,padding:'8px 0'}}>⚠ {warnings.length} avisos por comprobar en los originales</summary><ul style={{fontSize:13,paddingLeft:20,lineHeight:1.65}}>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>}
    <details><summary style={{cursor:'pointer',padding:'8px 0',fontSize:12}}>Acumulados impresos anteriores al periodo</summary><p style={{fontSize:12}}>Pagos: {money(source.cumulativePayments||0)} · Entregas: {money(source.cumulativeDeliveries||0)}. Incluyen antecedentes resumidos en el saldo anterior; no son movimientos adicionales.</p></details>
  </section>;
}
