import { Timestamp } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { addDays } from '../lib/finance';
import type { Invoice } from '../lib/types';
import type { FinanceConfigCore } from '../lib/finance';
import type { ParsedInvoiceData } from '../lib/xmlParser';

interface UseInvoiceParserProps {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void | Promise<void>;
  config: FinanceConfigCore;
  allOrders?: any[];
  orderId?: string;
}

export function useInvoiceParser({ invoices, setInvoices, config, allOrders = [], orderId = '' }: UseInvoiceParserProps) {
  const toast = useToast();

  const processFacturaText = async (text: string) => {
    // Prioridad de extracción del folio real de la factura:
    // 1) "Factura 6097" (encabezado estándar de los CFDI de Elemental Denim y similares)
    // 2) Folio="..." (estilo atributo XML)
    // 3) UUID del CFDI como último recurso
    // OJO: antes había un fallback /FOLIO\s+(\w+)/i que hacía match contra la
    // línea "FOLIO FISCAL (UUID)" del propio documento y capturaba literalmente
    // la palabra "FISCAL" como folio -- se eliminó por ser el origen de ese bug.
    const facturaHeaderMatch = text.match(/\bFactura\s+(\d+)\b/i);
    const xmlAttrMatch = text.match(/Folio\s*=\s*["']([^"']+)["']/i);
    const shortFolio = facturaHeaderMatch ? facturaHeaderMatch[1] : (xmlAttrMatch ? xmlAttrMatch[1] : '');
    const uuidMatch = text.match(/[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/i);
    const uuid = uuidMatch ? uuidMatch[0].toUpperCase() : '';

    const finalFolio = shortFolio || uuid;

    // Suma los kilos de TODOS los renglones de concepto (antes solo se tomaba
    // el primer match, así que una factura con 2+ conceptos en KG se
    // registraba con solo la cantidad del primero).
    const kilosMatches = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:KGM|KILOGRAMO|KG)\b/gi)];
    const kilos = kilosMatches.reduce((sum, m) => sum + (Number(m[1].replace(/,/g, '')) || 0), 0);
    
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

    if (finalFolio.toUpperCase().startsWith('GT') || finalFolio.toUpperCase().startsWith('TH')) {
      toast('Error: TH y GT son numeraciones exclusivas de un CONTRARECIBO. No se pueden registrar como número de Factura.', 'bad');
      return;
    }

    // Validación Antiduplicados
    const currentInvoicesFolios = invoices.map(i => i.folio?.trim().toUpperCase()).filter(Boolean);
    if (currentInvoicesFolios.includes(finalFolio.toUpperCase())) {
      toast(`La Factura #${finalFolio} ya existe en este mismo expediente.`, 'bad');
      return;
    }
    if (allOrders && allOrders.length > 0) {
      const duplicadoGlobal = allOrders.find(o => 
        (o.invoices || []).some((i: any) => i.folio?.trim().toUpperCase() === finalFolio.toUpperCase())
      );
      if (duplicadoGlobal) {
        toast(`La Factura #${finalFolio} ya fue registrada previamente en el expediente del cliente ${duplicadoGlobal.client || 'Desconocido'}.`, 'bad');
        return;
      }
    }

    const newInvoice: Invoice = {
      id: Date.now().toString(),
      orderId: orderId,
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

    // Antes esto llamaba a setInvoices() y mostraba el toast de éxito de
    // forma incondicional -- pero el setInvoices que pasa OrderModalProvider
    // era un no-op ("handle it properly later"), así que la factura nunca se
    // guardaba en Firestore aunque la UI dijera "Factura agregada". Ahora se
    // espera a que el guardado real termine antes de confirmar éxito.
    try {
      await setInvoices([...invoices, newInvoice]);
      toast(`Factura agregada. Folio: ${finalFolio || 'No encontrado'}, Kilos: ${kilos || 0}`, 'ok');
    } catch (e: any) {
      toast(`No se pudo guardar la factura: ${e?.message || 'error desconocido'}`, 'bad');
    }
  };

  const processParsedXml = async (data: ParsedInvoiceData) => {
    // Validación Antiduplicados
    const currentInvoicesFolios = invoices.map(i => i.folio?.trim().toUpperCase()).filter(Boolean);
    if (currentInvoicesFolios.includes(data.uuid)) {
      toast(`La Factura #${data.uuid} ya existe en este mismo expediente.`, 'bad');
      return;
    }
    if (allOrders && allOrders.length > 0) {
      const duplicadoGlobal = allOrders.find(o => 
        (o.invoices || []).some((i: any) => i.folio?.trim().toUpperCase() === data.uuid)
      );
      if (duplicadoGlobal) {
        toast(`La Factura #${data.uuid} ya fue registrada previamente en el expediente del cliente ${duplicadoGlobal.client || 'Desconocido'}.`, 'bad');
        return;
      }
    }

    // Inferir kilos desde los conceptos (buscando KG, KGM o algo parecido en la descripcion/unidad)
    let totalKilos = 0;
    data.conceptos.forEach(c => {
      totalKilos += c.cantidad; // Asumimos que la cantidad es kilos si es una empresa de empaques, pero puede que no.
      // Podríamos ser más inteligentes, pero tomaremos la cantidad por defecto.
    });

    // Asegurar que la fecha viene con la zona horaria correcta (generalmente el SAT devuelve YYYY-MM-DDTHH:mm:ss)
    const issue = new Date(data.fecha + 'Z'); 
    const due = addDays(issue, config.creditDays);

    const newInvoice: Invoice = {
      id: Date.now().toString(),
      orderId: orderId,
      folio: data.uuid,
      kilos: totalKilos, // O 0 si preferimos que lo llenen manual
      oc: '',
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

    try {
      await setInvoices([...invoices, newInvoice]);
      toast(`Factura XML Procesada. UUID: ${data.uuid}. Subtotal: $${data.subTotal}`, 'ok');
    } catch (e: any) {
      toast(`No se pudo guardar la factura: ${e?.message || 'error desconocido'}`, 'bad');
    }
  };

  const processPagoText = async (text: string) => {
    const cleanText = text.replace(/[\s-]/g, '').toUpperCase();
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let updatedCount = 0;
    let skippedCount = 0;
    
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
            const currentPaid = inv.collection?.paidAmount || 0;
            if (currentPaid >= pagado) {
              skippedCount++;
              return inv;
            }
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
          const currentPaid = inv.collection?.paidAmount || 0;
          if (currentPaid >= pagado) {
            skippedCount++;
            return inv;
          }
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

      // 3. Formato Providencia (Una sola línea plana: ej. TR_3640 5950 TH-680 31/07/2026 80,970.38)
      const singleLineRegex = new RegExp(`${invFolioUpper}\\s+((?:GT|TH)-\\d+)?\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+([\\d,]+\\.\\d{2})`, 'i');
      const singleLineMatch = text.match(singleLineRegex);
      if (singleLineMatch) {
        const pagado = Number(singleLineMatch[3].replace(/,/g, ''));
        const detectedCR = singleLineMatch[1] || crNumber;
        const currentPaid = inv.collection?.paidAmount || 0;
        if (currentPaid >= pagado) {
          skippedCount++;
          return inv;
        }
        updatedCount++;
        return {
          ...inv,
          collection: {
            ...(inv.collection || {}),
            paidAmount: pagado,
            contrareciboDate: Timestamp.now(),
            ...(detectedCR ? { contrareciboNumber: detectedCR } : {})
          }
        };
      }
      
      return inv;
    });

    // 4. XML crudo real de Complemento de Pago SAT (pago20:DoctoRelacionado).
    // Los formatos 1-3 de arriba esperan texto renderizado tipo PDF
    // ("IMP.PAGADO$", tablas con saltos de linea) -- el XML real trae
    // atributos XML estandar (Folio="5927" ImpPagado="92292.55") que
    // ninguno de esos tres reconoce. El folio de DoctoRelacionado casi
    // nunca coincide con inv.folio (la mayoria de facturas migradas
    // comparten el folio generico "S/N"), asi que se empareja por monto
    // exacto en vez de folio -- pero SOLO si exactamente una factura sin
    // pagar coincide con ese monto. Si hay ambiguedad (dos facturas
    // pendientes con el mismo monto) o ninguna coincide, no se aplica
    // nada: es preferible que el usuario lo aplique a mano a arriesgar
    // pagar la factura equivocada.
    if (updatedCount === 0) {
      const docRelRegex = /DoctoRelacionado[^>]*?Folio="(\d+)"[^>]*?ImpPagado="([\d.]+)"/gi;
      const fechaPagoMatch = text.match(/FechaPago="(\d{4}-\d{2}-\d{2})/);
      const fechaPago = fechaPagoMatch ? Timestamp.fromDate(new Date(fechaPagoMatch[1] + 'T12:00:00Z')) : Timestamp.now();
      const pagosDetectados: { folioDR: string; monto: number }[] = [];
      let m;
      while ((m = docRelRegex.exec(text)) !== null) {
        pagosDetectados.push({ folioDR: m[1], monto: Number(m[2]) });
      }
      if (pagosDetectados.length > 0) {
        const sinAplicar: string[] = [];
        const resultado = nextInvoices.map(inv => {
          const totalFactura = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const yaPagada = (inv.collection?.paidAmount || 0) >= totalFactura && totalFactura > 0;
          if (yaPagada) return inv;
          const candidatos = pagosDetectados.filter(p => Math.abs(p.monto - totalFactura) < 0.5);
          if (candidatos.length !== 1) return inv; // 0 o ambiguo -> no tocar
          // Confirmar que ese pago no calce igual de bien con otra factura sin pagar (ambiguedad cruzada)
          const otrasQueCalzan = nextInvoices.filter(other => {
            if (other.id === inv.id) return false;
            const otroTotal = other.financials?.invoiceTotal ?? other.financials?.saleTotal ?? 0;
            const otraYaPagada = (other.collection?.paidAmount || 0) >= otroTotal && otroTotal > 0;
            return !otraYaPagada && Math.abs(candidatos[0].monto - otroTotal) < 0.5;
          });
          if (otrasQueCalzan.length > 0) return inv; // ambiguo entre facturas -> no tocar
          updatedCount++;
          return {
            ...inv,
            collection: {
              ...(inv.collection || {}),
              paidAmount: candidatos[0].monto,
              contrareciboDate: fechaPago,
              ...(crNumber ? { contrareciboNumber: crNumber } : {}),
            },
          };
        });
        if (updatedCount > 0) {
          try {
            await setInvoices(resultado);
            toast(`Se actualizó el cobro de ${updatedCount} factura(s) por coincidencia de monto exacto.`, 'ok');
          } catch (e: any) {
            toast(`No se pudo guardar el cobro: ${e?.message || 'error desconocido'}`, 'bad');
          }
          return;
        }
        pagosDetectados.forEach(p => sinAplicar.push(`$${p.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`));
        if (sinAplicar.length > 0) {
          toast(`Se detectaron ${sinAplicar.length} pago(s) en el XML (${sinAplicar.join(', ')}) pero ninguno coincidió sin ambigüedad con una factura pendiente exacta. Aplícalo a mano.`, 'bad');
          return;
        }
      }
    }
    
    if (updatedCount > 0) {
      try {
        await setInvoices(nextInvoices);
        toast(`Se actualizó el cobro de ${updatedCount} factura(s) con éxito.${skippedCount > 0 ? ` Se omitieron ${skippedCount} pago(s) duplicado(s).` : ''}`, 'ok');
      } catch (e: any) {
        toast(`No se pudo guardar el cobro: ${e?.message || 'error desconocido'}`, 'bad');
      }
    } else if (skippedCount > 0) {
      toast(`Se omitieron ${skippedCount} pago(s) porque ya estaban registrados previamente.`, 'bad');
    } else {
      toast('No se encontró ningún Folio/UUID que coincida con las facturas de este expediente, o no se detectó el importe.', 'bad');
    }
  };

  return {
    processFacturaText,
    processParsedXml,
    processPagoText
  };
}
