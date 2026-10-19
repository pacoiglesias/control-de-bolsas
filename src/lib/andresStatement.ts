import {round2} from '../../functions/src/shared/finance.core';

export interface SupplierStatementRow {
  sequence: number; date: string; reference: string; payment: number; deliveryAmount: number;
  supplierBalance: number; notes: string; kilos: number; pricePerKg: number;
  orderReference: string; quantityAmountDifference: number;
}
export interface SupplierStatement {
  provider: 'Andres'; asOf: string; openingSupplierBalance: number; closingSupplierBalance: number;
  rows: SupplierStatementRow[]; totalPayments: number; totalDeliveries: number; totalKilos: number;
  cumulativePayments: number; cumulativeDeliveries: number; warnings: string[];
}
const amount=(value:string)=>Number(value.replace(/[$,\s]/g,''));
export function isSupplierStatement(text:string):boolean {
  return /ESTADO\s+DE\s+CUENTA/i.test(text)&&/NO\.?\s*VM/i.test(text)&&/PAGOS/i.test(text)&&/ENTREGAS/i.test(text)&&/Observaciones/i.test(text);
}
export interface PositionedStatementText {str:string;x:number;y:number}
/** Column coordinates preserve blank payments and deliveries; flattened text cannot. */
export function parseAndresStatementPositions(items:PositionedStatementText[],asOf:string):SupplierStatement {
  const headers=['FECHA','NO. VM','PAGOS','ENTREGAS','0.00','Observaciones'].map(label=>items.find(item=>item.str.trim().toUpperCase()===label.toUpperCase()));
  if(headers.some(header=>!header))throw new Error('No se identificaron todas las columnas del estado.');
  const boundaries=headers.slice(1).map((header,index)=>(header!.x+headers[index]!.x)/2);
  const column=(item:PositionedStatementText)=>{const index=boundaries.findIndex(boundary=>item.x<boundary);return index<0?5:index;};
  const dates=items.filter(item=>column(item)===0&&/^\d{2}\/\d{2}\/\d{4}$/.test(item.str.trim())).sort((a,b)=>b.y-a.y);
  if(!dates.length)throw new Error('Faltan fechas legibles.');
  const text=(parts:PositionedStatementText[])=>parts.sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x).map(part=>part.str.trim()).join(' ').trim();
  const opening=items.filter(item=>column(item)===4&&item.y<headers[0]!.y-2&&item.y>dates[0].y+2);
  if(opening.length!==1)throw new Error('El saldo anterior no es inequívoco.');
  const table:(string|null)[][]=[headers.map(header=>header!.str),['','','','',opening[0].str,'']];
  dates.forEach((date,index)=>{
    const previousY=index?dates[index-1].y:opening[0].y;
    table.push(Array.from({length:6},(_,col)=>text(items.filter(item=>column(item)===col&&(col===5?item.y<previousY-2&&item.y>=date.y-2:Math.abs(item.y-date.y)<=2)))));
  });
  table.push(Array.from({length:6},(_,col)=>text(items.filter(item=>column(item)===col&&item.y<dates[dates.length-1].y-2))));
  return parseAndresStatementRows(table,asOf);
}
export function parseAndresStatementRows(table:(string|null)[][],asOf:string):SupplierStatement {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('Falta la fecha de corte del estado de cuenta.');
  const header=table.findIndex(row=>/FECHA/i.test(row[0]||'')&&/PAGOS/i.test(row[2]||'')&&/ENTREGAS/i.test(row[3]||''));
  if(header<0)throw new Error('No se identificaron las columnas del estado de cuenta.');
  const opening=amount(table[header+1]?.[4]||'');if(!table[header+1]?.[4]?.trim()||!Number.isFinite(opening))throw new Error('Falta saldo anterior.');
  const rows:SupplierStatementRow[]=[];const warnings:string[]=[];let balance=opening;
  for(let index=header+2;index<table.length;index++){
    const cells=table[index].map(value=>(value||'').trim());if(!/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0]))continue;
    const date=cells[0].split('/').reverse().join('-');const payment=cells[2]?amount(cells[2]):0;const delivery=cells[3]?amount(cells[3]):0;const printed=amount(cells[4]);
    const parsedDate=new Date(date);if(!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date)throw new Error('Fecha inválida en el estado: '+cells[0]);
    if(!Number.isFinite(payment+delivery+printed)||payment<0||delivery<0||Boolean(payment)===Boolean(delivery))throw new Error('Movimiento ambiguo en '+cells[0]);
    if(date>asOf)throw new Error('Hay movimientos posteriores a la fecha de corte.');
    balance=round2(balance+delivery-payment);if(Math.abs(balance-printed)>0.01)throw new Error('El saldo no cuadra en '+cells[0]+' '+cells[1]);
    const notes=cells[5].replace(/\s+/g,' ');const quantity=notes.match(/([\d,]+(?:\.\d+)?)\s*KG/i);const price=notes.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const kilos=quantity?amount(quantity[1]):0;const pricePerKg=price?amount(price[1]):0;
    if(delivery&&(!cells[1]||!kilos||!pricePerKg))throw new Error('Faltan remisión, kilos o precio en '+cells[0]);
    const difference=delivery?round2(delivery-kilos*pricePerKg):0;
    if(Math.abs(difference)>0.01)warnings.push(cells[1]+': kilos por precio difieren $'+difference.toFixed(2)+' del importe impreso; comprobar remisión original.');
    const orderReference=notes.match(/\b(120\d{6,})\b/)?.[1]||'';
    if(delivery&&orderReference.length!==11&&orderReference.length!==12)warnings.push(cells[1]+': referencia de OC incompleta o por comprobar.');
    rows.push({sequence:rows.length+1,date,reference:cells[1]||'PAGO-'+date+'-'+payment.toFixed(2),payment,deliveryAmount:delivery,supplierBalance:printed,notes,kilos,pricePerKg,orderReference,quantityAmountDifference:difference});
  }
  if(!rows.length)throw new Error('No hay movimientos legibles.');
  const footer=[...table].reverse().find(row=>/SALDO A FAVOR/i.test(row[5]||''));if(!footer)throw new Error('Falta el cierre del estado de cuenta.');
  const closing=amount(footer[4]||'');const cumulativePayments=amount(footer[2]||'');const cumulativeDeliveries=amount(footer[3]||'');
  if(Math.abs(closing-balance)>0.01||Math.abs(round2(cumulativeDeliveries-cumulativePayments)-closing)>0.01)throw new Error('El cierre acumulado no coincide con sus movimientos.');
  const ids=rows.map(row=>row.reference);if(new Set(ids).size!==ids.length)throw new Error('Hay movimientos repetidos en el documento.');
  return {provider:'Andres',asOf,openingSupplierBalance:opening,closingSupplierBalance:closing,rows,totalPayments:round2(rows.reduce((sum,row)=>sum+row.payment,0)),totalDeliveries:round2(rows.reduce((sum,row)=>sum+row.deliveryAmount,0)),totalKilos:round2(rows.reduce((sum,row)=>sum+row.kilos,0)),cumulativePayments,cumulativeDeliveries,warnings};
}
