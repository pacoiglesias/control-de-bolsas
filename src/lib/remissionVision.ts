import {getFunctions,httpsCallable} from 'firebase/functions';
import {app} from './firebase';
import {parseVisionRemission} from './documentReconciliation';
import {confirmDialog} from './confirmDialog';

/** Uses the application's existing authenticated visual reader when OCR loses table cells. */
export async function readRemissionWithVision(file:File){
  if(file.size>15*1024*1024)throw new Error('La imagen supera 15 MB. Usa una foto más ligera y legible.');
  if(!await confirmDialog({message:'El texto de la foto no permite comprobar todas las partidas. ¿Permites que el lector Google Gemini procese esta imagen comercial para extraer sus kilos e importes?'}))throw new Error('Lectura visual no autorizada. Conserva el original para revisión local.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let index=0;index<bytes.length;index+=8192)binary+=String.fromCharCode(...bytes.subarray(index,index+8192));
  const callable=httpsCallable(getFunctions(app,'us-east1'),'parseDocumentData',{timeout:90000});
  const result=await callable({base64:btoa(binary),mimeType:file.type});
  return parseVisionRemission(result.data);
}
