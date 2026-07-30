import { Timestamp } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { addDays } from '../lib/finance';
import type { Invoice } from '../lib/types';
import type { FinanceConfigCore } from '../lib/finance';

interface UseInvoiceParserProps {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  config: FinanceConfigCore;
}

export function useInvoiceParser({ invoices, setInvoices, config }: UseInvoiceParserProps) {
  const toast = useToast();

  const processFacturaText = (text: string) => {
    const shortFolioMatch = text.match(/Folio\s*=\s*["']([^"']+)["']/i) || text.match(/FOLIO\s+(\w+)/i);
    const shortFolio = shortFolioMatch ? shortFolioMatch[1] : '';
    const uuidMatch = text.match(/[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/i);
    const uuid = uuidMatch ? uuidMatch[0].toUpperCase() : '';
    
    const finalFolio = shortFolio || uuid;
    
    const kilosMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(?:KGM|KILOGRAMO|KG)/i);
    const kilos = kilosMatch ? Number(kilosMatch[1].replace(/,/g, '')) : 0;
    
    const dateMatch = text.match(/\|(\d{4}-\d{2}-\d{2})T/);
    const issueDateStr = dateMatch ? dateMatch[1] : '';
    const issue = issueDateStr ? new Date(issueDateStr + 'T12:00:00Z') : new Date();
    const due = addDays(issue, config.creditDays);
    
    const ocMatch = text.match(/CONDICIONES DE PAGO\s*(?:OC\s*)?(\w+)/i) || text.match(/OC\s+(\d+)/i);
    const oc = ocMatch ? ocMatch[1] : '';

    if (!finalFolio && !kilos) {
      toast('No se encontró ni el Folio/UUID ni los kilos. Revisa el texto pegado o subido.', 'bad');
      return;
    }

    // Creating object that strictly satisfies the Invoice interface
    const newInvoice: Invoice = {
      id: Date.now().toString(),
      folio: finalFolio,
      kilos: kilos,
      oc: oc,
      creditCycle: { 
        status: 'pending', 
        issueDate: Timestamp.fromDate(issue), 
        dueDate: Timestamp.fromDate(due) 
      },
      collection: { 
        paidAmount: 0, 
        contrareciboNumber: '', 
        notes: '' 
      }
    };

    setInvoices([...invoices, newInvoice]);
    toast(`Factura agregada. Folio: ${finalFolio || 'No encontrado'}, Kilos: ${kilos || 0}`, 'ok');
  };

  const processPagoText = (text: string) => {
    const cleanText = text.replace(/[\s-]/g, '').toUpperCase();
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let updatedCount = 0;
    
    // Buscar si el texto menciona un número de Contrarecibo explícito (GT-12345 o TH-12345)
    const crMatch = text.match(/((?:GT|TH)-\d+)/i);
    const crNumber = crMatch ? crMatch[1].toUpperCase() : undefined;
    
    const nextInvoices = invoices.map(inv => {
      if (!inv.folio) return inv;
      
      // 1. Formato Providencia (Multi-línea tabular: Folio -> Detalle -> Fecha -> Importe)
      const invFolioUpper = inv.folio.trim().toUpperCase();
      for (let i = 0; i < rawLines.length - 3; i++) {
        if (rawLines[i].toUpperCase() === invFolioUpper) {
          const dateMatch = rawLines[i+2].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
          const amtMatch = rawLines[i+3].replace(/[$,]/g, '').match(/^(\d+(\.\d{2})?)$/);
          if (dateMatch && amtMatch) {
            const pagado = Number(amtMatch[1]);
            updatedCount++;
            return {
              ...inv,
              collection: {
                ...(inv.collection || {}),
                paidAmount: pagado,
                contrareciboDate: Timestamp.now(),
                ...(crNumber ? { contrareciboNumber: crNumber } : {})
              }
            };
          }
        }
      }

      // 2. Formato SAT Complemento XML/PDF (UUID matching)
      const cleanUuid = inv.folio.replace(/[\s-]/g, '').toUpperCase();
      if (cleanUuid.length > 10 && cleanText.includes(cleanUuid)) {
        const regex = new RegExp(cleanUuid + '.*?IMP\\.?PAGADO\\$([\\d,]+\\.\\d{2})', 'i');
        const match = cleanText.match(regex);
        if (match) {
          const pagado = Number(match[1].replace(/,/g, ''));
          updatedCount++;
          return {
            ...inv,
            collection: {
              ...(inv.collection || {}),
              paidAmount: pagado,
              contrareciboDate: Timestamp.now(),
              ...(crNumber ? { contrareciboNumber: crNumber } : {})
            }
          };
        }
      }
      
      return inv;
    });
    
    if (updatedCount > 0) {
      setInvoices(nextInvoices);
      toast(`Se actualizó el cobro de ${updatedCount} factura(s) con éxito.`, 'ok');
    } else {
      toast('No se encontró ningún Folio/UUID que coincida con las facturas de este expediente, o no se detectó el importe.', 'bad');
    }
  };

  return {
    processFacturaText,
    processPagoText
  };
}
