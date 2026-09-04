import { Timestamp } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { addDays } from '../lib/finance';
import type { Invoice, PurchaseOrderItem } from '../lib/types';
import type { FinanceConfigCore } from '../lib/finance';
import type { ParsedInvoiceData } from '../lib/xmlParser';

export function extractInvoiceItemsFromText(text: string, defaultPrice: number = 43): PurchaseOrderItem[] {
  const items: PurchaseOrderItem[] = [];
  if (!text) return items;

  // Buscar bloques que inician con "{Cantidad} KGM - KILOGRAMO" o "{Cantidad} KGM" o "{Cantidad} KG"
  // Seguido de la descripción / código, clave SAT, y montos
  const conceptRegex = /([\d,]+(?:\.\d+)?)\s*(?:KGM\s*-\s*KILOGRAMO|KGM|KILOGRAMO|KG)\s+([\s\S]+?)(?=(?:[\d,]+(?:\.\d+)?\s*(?:KGM\s*-\s*KILOGRAMO|KGM|KILOGRAMO|KG)|IMPORTE CON LETRA|SUBTOTAL|\n\s*SUBTOTAL|$))/gi;
  
  let match;
  while ((match = conceptRegex.exec(text)) !== null) {
    const qtyStr = match[1];
    const block = match[2];
    const quantity = Number(qtyStr.replace(/,/g, ''));
    if (!quantity || quantity <= 0) continue;

    // Extraer primera línea del bloque como descripción / código
    const firstLine = block.trim().split('\n')[0] || '';
    
    // Extraer clave SAT si existe
    const satMatch = block.match(/Clave\s*Prod\.?\s*Serv\.?\s*-\s*(\d+)/i);
    const satCode = satMatch ? satMatch[1] : '';

    // Extraer montos del bloque
    const priceMatch = block.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const amountsMatch = [...block.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)];
    
    let unitPrice = defaultPrice;
    let amount = quantity * unitPrice;

    if (amountsMatch.length >= 2) {
      const lastAmount = Number(amountsMatch[amountsMatch.length - 1][1].replace(/,/g, ''));
      if (lastAmount > 0) {
        amount = lastAmount;
        unitPrice = Math.round((amount / quantity) * 100) / 100;
      }
    } else if (priceMatch) {
      const p = Number(priceMatch[1].replace(/,/g, ''));
      if (p > 0 && p < 1000) {
        unitPrice = p;
        amount = quantity * unitPrice;
      }
    }

    // Separar código y descripción de firstLine
    let code = satCode || '24141500';
    let description = firstLine.trim();

    // 1. Caso código pegado directamente a la descripción (ej: "EGBO000018-SCBOLSA POLIETILENO...")
    const stuckCode = firstLine.match(/^([a-zA-Z0-9]{4,15}-(?:SC|BL|sc|bl|[a-zA-Z]{2}))([a-zA-Z].+)$/);
    if (stuckCode) {
      code = stuckCode[1];
      description = stuckCode[2].trim();
    } else {
      const codeSplit = firstLine.match(/^([a-zA-Z0-9_\-]+)\s+(.+)$/);
      if (codeSplit) {
        code = codeSplit[1];
        description = codeSplit[2].trim();
      }
    }

    items.push({
      id: 'inv_item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: code || '24141500',
      description: description || 'Bolsa de Polietileno',
      quantity,
      unit: 'Kilos',
      unitPrice,
      amount,
    });
  }

  return items;
}

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

    const subtotalMatch = text.match(/SUBTOTAL\s*\$?\s*([\d,]+\.\d{2})/i);
    const totalMatch = text.match(/TOTAL\s*\$?\s*([\d,]+\.\d{2})/i);
    
    // Extraer conceptos/partidas detalladas de la factura
    const items = extractInvoiceItemsFromText(text, config?.salePricePerKg || 43);
    const calculatedKilos = items.reduce((s, it) => s + (it.quantity || 0), 0);
    const finalKilos = kilos > 0 ? kilos : calculatedKilos;

    const calculatedSubtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
    const subtotal = subtotalMatch ? Number(subtotalMatch[1].replace(/,/g, '')) : (calculatedSubtotal > 0 ? calculatedSubtotal : (finalKilos * (config?.salePricePerKg || 43)));
    const total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : (subtotal * 1.16);

    const newInvoice: Invoice = {
      id: Date.now().toString(),
      orderId: orderId,
      folio: finalFolio,
      kilos: finalKilos,
      oc: oc,
      items: items.length > 0 ? items : undefined,
      financials: {
        salePricePerKg: config?.salePricePerKg || 43,
        costPricePerKg: config?.costPricePerKg || 38,
        commissionRate: config?.commissionRate || 0.08,
        saleTotal: subtotal,
        costTotal: finalKilos * (config?.costPricePerKg || 38),
        commission: subtotal * (config?.commissionRate || 0.08),
        invoiceTotal: total,
        netCashFlow: subtotal - (finalKilos * (config?.costPricePerKg || 38)) - (subtotal * (config?.commissionRate || 0.08)),
      },
      creditCycle: { 
        status: 'pending', 
        issueDate: Timestamp.fromDate(issue), 
        dueDate: Timestamp.fromDate(due) 
      },
      collection: { 
        paidAmount: 0, 
        contrareciboNumber: '', 
        notes: items.length > 0 ? `Conceptos: ${items.map(it => `${it.description} (${it.quantity} kg)`).join(' · ')}` : ''
      }
    };

    // Espera a que el guardado real termine antes de confirmar éxito.
    try {
      await setInvoices([...invoices, newInvoice]);
      toast(`✅ Factura #${finalFolio || 'S/N'} agregada con ${items.length > 0 ? `${items.length} conceptos y ` : ''}${finalKilos.toLocaleString('es-MX')} kg.`, 'ok');
    } catch (e: any) {
      toast(`No se pudo guardar la factura: ${e?.message || 'error desconocido'}`, 'bad');
    }
  };

  const processParsedXml = async (data: ParsedInvoiceData) => {
    const finalFolio = data.folio || data.uuid;

    // Validación Antiduplicados
    const currentInvoicesFolios = invoices.map(i => i.folio?.trim().toUpperCase()).filter(Boolean);
    if (currentInvoicesFolios.includes(finalFolio.toUpperCase()) || currentInvoicesFolios.includes(data.uuid.toUpperCase())) {
      toast(`La Factura #${finalFolio} ya existe en este mismo expediente.`, 'bad');
      return;
    }
    if (allOrders && allOrders.length > 0) {
      const duplicadoGlobal = allOrders.find(o => 
        (o.invoices || []).some((i: any) => 
          i.folio?.trim().toUpperCase() === finalFolio.toUpperCase() ||
          i.folio?.trim().toUpperCase() === data.uuid.toUpperCase() ||
          i.collection?.sapDocument?.trim().toUpperCase() === data.uuid.toUpperCase()
        )
      );
      if (duplicadoGlobal) {
        toast(`La Factura #${finalFolio} ya fue registrada previamente en el expediente del cliente ${duplicadoGlobal.client || 'Desconocido'}.`, 'bad');
        return;
      }
    }

    // Extraer conceptos desde el XML
    const xmlItems: PurchaseOrderItem[] = (data.conceptos || []).map((c, idx) => ({
      id: 'inv_item_' + Date.now().toString(36) + '_' + idx,
      code: c.codigo || c.claveProdServ || '24141500',
      description: c.descripcion || 'Bolsa de Polietileno',
      quantity: c.cantidad || 0,
      unit: c.claveUnidad || 'Kilos',
      unitPrice: c.valorUnitario || config?.salePricePerKg || 43,
      amount: c.importe || ((c.cantidad || 0) * (c.valorUnitario || 43)),
    }));

    let totalKilos = xmlItems.reduce((s, it) => s + (it.quantity || 0), 0);
    const subtotal = data.subTotal || xmlItems.reduce((s, it) => s + it.amount, 0);
    const total = data.total || (subtotal * 1.16);

    // Asegurar que la fecha viene con la zona horaria correcta
    const issue = new Date(data.fecha + 'Z'); 
    const due = addDays(issue, config.creditDays);

    const newInvoice: Invoice = {
      id: Date.now().toString(),
      orderId: orderId,
      folio: finalFolio,
      kilos: totalKilos,
      oc: data.ocNumber || '',
      items: xmlItems.length > 0 ? xmlItems : undefined,
      financials: {
        salePricePerKg: config?.salePricePerKg || 43,
        costPricePerKg: config?.costPricePerKg || 38,
        commissionRate: config?.commissionRate || 0.08,
        saleTotal: subtotal,
        costTotal: totalKilos * (config?.costPricePerKg || 38),
        commission: subtotal * (config?.commissionRate || 0.08),
        invoiceTotal: total,
        netCashFlow: subtotal - (totalKilos * (config?.costPricePerKg || 38)) - (subtotal * (config?.commissionRate || 0.08)),
      },
      creditCycle: { 
        status: 'pending', 
        issueDate: Timestamp.fromDate(issue), 
        dueDate: Timestamp.fromDate(due) 
      },
      collection: { 
        paidAmount: 0, 
        contrareciboNumber: '', 
        sapDocument: data.uuid,
        notes: xmlItems.length > 0 ? `Conceptos XML: ${xmlItems.map(it => `${it.code} - ${it.description} (${it.quantity} kg)`).join(' · ')}` : ''
      }
    };

    try {
      await setInvoices([...invoices, newInvoice]);
      toast(`✅ Factura XML Procesada. UUID: ${data.uuid}. Subtotal: $${data.subTotal}`, 'ok');
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
