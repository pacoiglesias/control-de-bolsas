import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui';
import { round2 } from '../../lib/finance';
import { money, toInputDate } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useToast } from '../../context/ToastContext';
import { useConfig } from '../../hooks/useConfig';
import { downloadCfdi40DraftXmlFile, type CfdiDraftData } from '../../lib/cfdiXmlGenerator';
import { downloadPrefacturaExcel, type PrefacturaExcelData } from '../../lib/excelTemplateGenerator';
import { generatePrefacturaContadorMessage, openWhatsAppMessage } from '../../lib/whatsappReminder';
import { safeUpdateDoc } from '../../lib/safeFirestore';
import { doc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { logAction } from '../../lib/logger';
import {
  type PurchaseOrder,
  type OrderStatus,
  CANONICAL_GT_ITEMS_439806,
  CANONICAL_GT_ITEMS_439807,
} from '../../lib/types';
import { isOcTH } from '../../lib/constants';

export interface PrefacturaCfdiItem {
  id: string;
  code: string;
  description: string;
  claveSat: string;
  unidadSat: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  iva: number;
  total: number;
}

interface PrefacturadorCfdiModalProps {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onClose: () => void;
  onInvoiceRegistered?: (orderId: string, invoice: any) => void;
}

export function PrefacturadorCfdiModal({
  orders,
  initialOrderId,
  onClose,
  onInvoiceRegistered,
}: PrefacturadorCfdiModalProps) {
  const toast = useToast();
  const { config } = useConfig();

  // Filtrar órdenes disponibles para prefacturar (con kilos pendientes de facturar o abiertas)
  const candidateOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if ((o as any).isDeleted || o.isClosedShort) return false;
      const oc = (o.oc || o.folio || o.id || '').toUpperCase();
      if (/^(?:GT|TH)-\d+$/i.test(oc)) return false;
      return true;
    });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (initialOrderId && candidateOrders.some((o) => o.id === initialOrderId)) {
      return initialOrderId;
    }
    // Prioridad por omisión: 9806 o 9807 si existen
    const order9806 = candidateOrders.find((o) => (o.oc || o.folio || '').includes('9806'));
    if (order9806) return order9806.id;
    const order9807 = candidateOrders.find((o) => (o.oc || o.folio || '').includes('9807'));
    if (order9807) return order9807.id;
    return candidateOrders[0]?.id || '';
  });

  const selectedOrder = useMemo(() => {
    return candidateOrders.find((o) => o.id === selectedOrderId) || null;
  }, [candidateOrders, selectedOrderId]);

  // Datos de encabezado configurables y editables
  const [serie, setSerie] = useState('F');
  const [folioNumber, setFolioNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => toInputDate(new Date()));
  const [condicionesPago, setCondicionesPago] = useState('Crédito 30 días');
  const [metodoPago, setMetodoPago] = useState<'PPD' | 'PUE'>('PPD');
  const [formaPago, setFormaPago] = useState('99'); // 99: Por definir
  const emisorRfc = 'EDE1902136T2';
  const emisorName = 'ELEMENTAL DENIM SA DE CV';
  const emisorCp = '72150';
  const emisorRegimen = '601';

  const [receptorRfc, setReceptorRfc] = useState('GTP930115PU1');
  const [receptorName, setReceptorName] = useState('GRUPO TEXTIL PROVIDENCIA SA DE CV');
  const [receptorCp, setReceptorCp] = useState('90800');
  const [receptorRegimen, setReceptorRegimen] = useState('601');
  const [receptorUsoCfdi, setReceptorUsoCfdi] = useState('G03');

  // Partidas editables
  const [items, setItems] = useState<PrefacturaCfdiItem[]>([]);
  const [savingInErp, setSavingInErp] = useState(false);

  // Inicializar o cambiar de orden
  useEffect(() => {
    if (!selectedOrder) {
      setItems([]);
      return;
    }

    const oc = (selectedOrder.oc || selectedOrder.folio || '').toUpperCase();
    const isTH = isOcTH(oc);

    // Actualizar datos del receptor si aplica
    if (isTH) {
      setCondicionesPago(`Crédito 30 días · OC ${selectedOrder.folio || selectedOrder.oc} (Textil Hogar / Nava)`);
    } else {
      setCondicionesPago(`Crédito 30 días · OC ${selectedOrder.folio || selectedOrder.oc} (Planta P4 / Evelia)`);
    }

    // Inicializar partidas según orden específica
    const baseUnitPrice = Number(config.salePricePerKg) || 43.0;

    if (oc.includes('9806')) {
      // OC Oficial 12026439806: 2,478.35 kg entregados
      setItems(
        CANONICAL_GT_ITEMS_439806.map((it, idx) => ({
          id: `item-9806-${idx + 1}`,
          code: it.code || 'EGBO000017-SC',
          description: it.description,
          claveSat: '24111500',
          unidadSat: 'KGM',
          quantity: it.quantity,
          unitPrice: baseUnitPrice,
          subtotal: round2(it.quantity * baseUnitPrice),
          iva: round2(it.quantity * baseUnitPrice * 0.16),
          total: round2(it.quantity * baseUnitPrice * 1.16),
        }))
      );
    } else if (oc.includes('9807')) {
      // OC Oficial 12026439807: 2,955.80 kg entregados
      setItems(
        CANONICAL_GT_ITEMS_439807.map((it, idx) => ({
          id: `item-9807-${idx + 1}`,
          code: it.code || 'EGBO000018-SC',
          description: it.description,
          claveSat: '24111500',
          unidadSat: 'KGM',
          quantity: it.quantity,
          unitPrice: baseUnitPrice,
          subtotal: round2(it.quantity * baseUnitPrice),
          iva: round2(it.quantity * baseUnitPrice * 0.16),
          total: round2(it.quantity * baseUnitPrice * 1.16),
        }))
      );
    } else if (selectedOrder.items && selectedOrder.items.length > 0) {
      // Tomar de los ítems de la orden
      const defaultItems: PrefacturaCfdiItem[] = selectedOrder.items.map((it, idx) => {
        const qty = Number(it.deliveredQuantity || it.quantity) || 0;
        const pr = Number(it.unitPrice) || baseUnitPrice;
        const sub = round2(qty * pr);
        const iva = round2(sub * 0.16);
        return {
          id: it.id || `item-custom-${idx}`,
          code: it.code || 'EGBO-POLIETILENO',
          description: it.description || 'BOLSA POLIETILENO',
          claveSat: '24111500',
          unidadSat: 'KGM',
          quantity: qty,
          unitPrice: pr,
          subtotal: sub,
          iva,
          total: round2(sub + iva),
        };
      });
      setItems(defaultItems);
    } else {
      // Fallback genérico de 1 partida
      const totKilos = Number(selectedOrder.totalKilograms) || 1000;
      const sub = round2(totKilos * baseUnitPrice);
      const iva = round2(sub * 0.16);
      setItems([
        {
          id: 'item-fallback-1',
          code: 'EGBO000017-SC',
          description: 'BOLSA POLIETILENO TRANSPARENTE EN KILOGRAMOS',
          claveSat: '24111500',
          unidadSat: 'KGM',
          quantity: totKilos,
          unitPrice: baseUnitPrice,
          subtotal: sub,
          iva,
          total: round2(sub + iva),
        },
      ]);
    }
  }, [selectedOrder, config.salePricePerKg]);

  // Totales financieros calculados dinámicamente con cuadre exacto
  const totales = useMemo(() => {
    const totalKilos = round2(items.reduce((s, it) => s + (Number(it.quantity) || 0), 0));
    const subtotal = round2(items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0));
    const totalIva = round2(items.reduce((s, it) => s + (Number(it.iva) || 0), 0));
    const total = round2(subtotal + totalIva);

    // Margen estimado oficial:
    // Comisión contador: 8% del Subtotal
    const comisionContador = round2(subtotal * 0.08);
    // Maquila Andrés ($37 o $38 / kg)
    const tarifaMaquila = Number(config.costPricePerKg) || 37.0;
    const costoMaquila = round2(totalKilos * tarifaMaquila);
    const gananciaEstimada = round2(subtotal - comisionContador - costoMaquila);

    return {
      totalKilos,
      subtotal,
      totalIva,
      total,
      comisionContador,
      costoMaquila,
      gananciaEstimada,
      tarifaMaquila,
    };
  }, [items, config.costPricePerKg]);

  // Actualizar campo de una partida
  const handleUpdateItem = (id: string, field: keyof PrefacturaCfdiItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const q = Number(field === 'quantity' ? value : it.quantity) || 0;
          const p = Number(field === 'unitPrice' ? value : it.unitPrice) || 0;
          const sub = round2(q * p);
          const iva = round2(sub * 0.16);
          updated.quantity = q;
          updated.unitPrice = p;
          updated.subtotal = sub;
          updated.iva = iva;
          updated.total = round2(sub + iva);
        }
        return updated;
      })
    );
  };

  const handleAddItem = () => {
    const saleP = Number(config.salePricePerKg) || 43.0;
    const newItem: PrefacturaCfdiItem = {
      id: `item-${Date.now()}`,
      code: 'EGBO-NUEVA',
      description: 'BOLSA POLIETILENO',
      claveSat: '24111500',
      unidadSat: 'KGM',
      quantity: 500,
      unitPrice: saleP,
      subtotal: round2(500 * saleP),
      iva: round2(500 * saleP * 0.16),
      total: round2(500 * saleP * 1.16),
    };
    setItems((prev) => [...prev, newItem]);
    triggerHaptic('light');
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast('Debe haber al menos 1 partida en la prefactura', 'bad');
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
    triggerHaptic('light');
  };

  // 1. Descargar Borrador XML CFDI 4.0
  const handleDownloadXml = () => {
    triggerHaptic('medium');
    const cfdiData: CfdiDraftData = {
      ocNumber: selectedOrder?.oc || selectedOrder?.folio || 'S/N',
      clientName: receptorName,
      clientRfc: receptorRfc,
      clientPostalCode: receptorCp,
      clientRegimen: receptorRegimen,
      clientUsoCfdi: receptorUsoCfdi,
      emisorName,
      emisorRfc,
      emisorPostalCode: emisorCp,
      emisorRegimen,
      items: items.map((it) => ({
        code: it.code,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
        iva: it.iva,
        total: it.total,
      })),
    };

    downloadCfdi40DraftXmlFile(cfdiData);
    toast('📥 Borrador XML CFDI 4.0 descargado exitosamente', 'ok');
  };

  // 2. Descargar Prefactura Excel (.xlsx)
  const handleDownloadExcel = () => {
    triggerHaptic('medium');
    const excelData: PrefacturaExcelData = {
      clientName: receptorName,
      clientRfc: receptorRfc,
      clientAddress: `CP ${receptorCp}, Tlaxcala, México`,
      clientUsoCfdi: `Uso CFDI: ${receptorUsoCfdi} - Gastos en general`,
      oc: selectedOrder?.folio || selectedOrder?.oc || 'S/N',
      metodoPago,
      formaPago,
      claveSat: items[0]?.claveSat || '24111500',
      unidadSat: items[0]?.unidadSat || 'KGM',
      notaCondiciones: condicionesPago,
      items: items.map((it) => ({
        kilos: it.quantity,
        description: it.description,
        unitPrice: it.unitPrice,
        total: it.subtotal,
      })),
    };

    const ocClean = (selectedOrder?.folio || selectedOrder?.oc || 'OC').replace(/\//g, '_');
    downloadPrefacturaExcel(excelData, `Prefactura_CFDI40_OC_${ocClean}.xlsx`);
    toast('📊 Prefactura en Excel descargada exitosamente', 'ok');
  };

  // 3. Enviar Solicitud Formal por WhatsApp al Contador
  const handleSendWhatsApp = () => {
    triggerHaptic('medium');
    const msg = generatePrefacturaContadorMessage({
      oc: selectedOrder?.folio || selectedOrder?.oc || 'S/N',
      client: selectedOrder?.client || receptorName,
      kilos: totales.totalKilos,
      subtotal: totales.subtotal,
      iva: totales.totalIva,
      total: totales.total,
      itemsCount: items.length,
    });
    openWhatsAppMessage(msg);
  };

  // 4. Registrar en Firestore dentro del Expediente
  const handleSaveToErp = async () => {
    if (!selectedOrder) return;
    setSavingInErp(true);
    triggerHaptic('heavy');

    try {
      const invFolio = folioNumber.trim() ? `${serie}-${folioNumber.trim()}` : `PRE-${selectedOrder.folio || selectedOrder.oc}`;
      const newInvoice = {
        id: `inv-${Date.now()}`,
        folio: invFolio,
        uuid: '',
        kilos: totales.totalKilos,
        status: 'facturado',
        issueDate: Timestamp.fromDate(new Date(issueDate + 'T12:00:00')),
        dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
        financials: {
          subtotal: totales.subtotal,
          tax: totales.totalIva,
          invoiceTotal: totales.total,
          saleTotal: totales.total,
          unitPrice: items[0]?.unitPrice || 43.0,
          costTotal: totales.costoMaquila,
          comisionContador: totales.comisionContador,
        },
        items: items.map((it) => ({
          code: it.code,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          claveSat: it.claveSat,
        })),
        creditCycle: {
          status: 'pending' as OrderStatus,
          issueDate: Timestamp.fromDate(new Date(issueDate + 'T12:00:00')),
          dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
        },
        collection: {
          contrareciboNumber: '',
          paidAmount: 0,
        },
        createdAt: Timestamp.now(),
        notes: `Generada desde Pre-facturador CFDI 4.0 (${condicionesPago})`,
      };

      const existingInvoices = selectedOrder.invoices || [];
      const updatedInvoices = [...existingInvoices, newInvoice];

      await safeUpdateDoc(doc(db, PATHS.orders, selectedOrder.id), {
        invoices: updatedInvoices,
        updatedAt: Timestamp.now(),
      });

      await logAction('admin@ruenisco.com', 'CFDI_PREFACTURA_GENERATED', {
        orderId: selectedOrder.id,
        oc: selectedOrder.oc,
        folio: invFolio,
        kilos: totales.totalKilos,
        total: totales.total,
      });

      toast(`✅ Prefactura ${invFolio} registrada exitosamente en el expediente de la OC`, 'ok');
      if (onInvoiceRegistered) {
        onInvoiceRegistered(selectedOrder.id, newInvoice);
      }
      onClose();
    } catch (err: any) {
      console.error('[PrefacturadorCfdiModal] Error al registrar en ERP:', err);
      toast('Error al registrar la prefactura en el expediente: ' + err.message, 'bad');
    } finally {
      setSavingInErp(false);
    }
  };

  return (
    <Modal onClose={onClose} wide title="🧾 Pre-facturador CFDI 4.0 Configurable y Editable">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: 'var(--ink)' }}>
        {/* ENCABEZADO Y SELECTOR DE ORDEN */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(29, 78, 216, 0.05) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>
                Configuración Fiscal CFDI 4.0 para Timbrado
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Personaliza conceptos, claves SAT, precios y descarga el XML o Excel oficial sin errores.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Expediente / OC:</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="input boxed"
              style={{ padding: '6px 12px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}
            >
              {candidateOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  OC {o.folio || o.oc} — {o.client || 'GTP'} ({Number(o.totalKilograms || 0).toLocaleString('es-MX')} kg)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DATOS FISCALES RECEPTOR Y EMISOR (EDITABLES) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {/* RECEPTOR */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'var(--paper-sunk)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', marginBottom: 8 }}>
              🏢 RECEPTOR (CLIENTE)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>RFC Receptor</label>
                <input
                  type="text"
                  className="input"
                  value={receptorRfc}
                  onChange={(e) => setReceptorRfc(e.target.value.toUpperCase())}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>CP Receptor</label>
                <input
                  type="text"
                  className="input"
                  value={receptorCp}
                  onChange={(e) => setReceptorCp(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Razón Social</label>
                <input
                  type="text"
                  className="input"
                  value={receptorName}
                  onChange={(e) => setReceptorName(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Régimen Fiscal</label>
                <input
                  type="text"
                  className="input"
                  value={receptorRegimen}
                  onChange={(e) => setReceptorRegimen(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Uso CFDI</label>
                <input
                  type="text"
                  className="input"
                  value={receptorUsoCfdi}
                  onChange={(e) => setReceptorUsoCfdi(e.target.value.toUpperCase())}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
            </div>
          </div>

          {/* DATOS COMERCIALES / PREFACTURA */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'var(--paper-sunk)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', marginBottom: 8 }}>
              📋 CONDICIONES COMERCIALES Y SERIE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Serie / Folio Sugerido</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="text"
                    className="input"
                    value={serie}
                    onChange={(e) => setSerie(e.target.value.toUpperCase())}
                    style={{ width: 45, fontSize: 12, padding: '5px 6px', textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="6393..."
                    value={folioNumber}
                    onChange={(e) => setFolioNumber(e.target.value)}
                    style={{ flex: 1, fontSize: 12, padding: '5px 8px' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Fecha Emisión</label>
                <input
                  type="date"
                  className="input"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Condiciones de Pago</label>
                <input
                  type="text"
                  className="input"
                  value={condicionesPago}
                  onChange={(e) => setCondicionesPago(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Método de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="input"
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                >
                  <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                  <option value="PUE">PUE - Pago en una sola exhibición</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Forma de Pago</label>
                <select
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                >
                  <option value="99">99 - Por definir</option>
                  <option value="03">03 - Transferencia electrónica</option>
                  <option value="01">01 - Efectivo</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* TABLA EDITABLE DE CONCEPTOS */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            background: 'var(--paper)',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--paper-sunk)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              📦 Partidas y Kilos a Facturar ({items.length} Concepto{items.length === 1 ? '' : 's'})
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="btn"
              style={{
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                cursor: 'pointer',
              }}
            >
              ➕ Agregar Partida
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--paper-sunk)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', width: 110 }}>Clave SAT</th>
                  <th style={{ padding: '8px 10px', width: 130 }}>Código</th>
                  <th style={{ padding: '8px 10px' }}>Descripción</th>
                  <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>Kilos</th>
                  <th style={{ padding: '8px 10px', width: 100, textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '8px 10px', width: 90, textAlign: 'right' }}>IVA (16%)</th>
                  <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '8px 10px', width: 40, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        className="input"
                        value={it.claveSat}
                        onChange={(e) => handleUpdateItem(it.id, 'claveSat', e.target.value)}
                        style={{ width: '100%', fontSize: 11.5, padding: '4px 6px' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        className="input"
                        value={it.code}
                        onChange={(e) => handleUpdateItem(it.id, 'code', e.target.value)}
                        style={{ width: '100%', fontSize: 11.5, padding: '4px 6px' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        className="input"
                        value={it.description}
                        onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                        style={{ width: '100%', fontSize: 11.5, padding: '4px 6px' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', fontSize: 12, fontWeight: 700, padding: '4px 6px', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={it.unitPrice}
                        onChange={(e) => handleUpdateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', fontSize: 12, padding: '4px 6px', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {money(it.subtotal)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                      {money(it.iva)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                      {money(it.total)}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                        title="Eliminar partida"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RESUMEN FINANCIERO Y CUADRE MATEMÁTICO */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Totales de la Factura
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {money(totales.total)} <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>(con IVA)</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              Kilos amparados: <strong>{totales.totalKilos.toLocaleString('es-MX')} kg</strong> · Subtotal: <strong>{money(totales.subtotal)}</strong> · IVA (16%): <strong>{money(totales.totalIva)}</strong>
            </div>
          </div>

          {/* DESGLOSE DE MARGEN Y COMISIONES */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--paper-sunk)',
              border: '1px solid var(--border)',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>Comisión Contador (8%):</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>{money(totales.comisionContador)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>Maquila Andrés (${totales.tarifaMaquila}/kg):</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#c084fc' }}>{money(totales.costoMaquila)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>Margen Neto Proyectado:</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399' }}>{money(totales.gananciaEstimada)}</div>
            </div>
          </div>
        </div>

        {/* ACCIONES DE EXPORTACIÓN Y TIMBRADO */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            className="btn"
            onClick={handleDownloadXml}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
            title="Descargar archivo XML estándar CFDI 4.0 para el PAC o portal fiscal"
          >
            <span>📥</span>
            <span>Borrador XML CFDI 4.0</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleDownloadExcel}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
            title="Descargar plantilla Excel oficial para el facturador"
          >
            <span>📊</span>
            <span>Prefactura Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleSendWhatsApp}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
            }}
            title="Enviar datos completos de facturación al contador por WhatsApp"
          >
            <span>📲</span>
            <span>WhatsApp al Contador</span>
          </button>

          <button
            type="button"
            className="btn"
            disabled={savingInErp}
            onClick={handleSaveToErp}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 900,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              cursor: savingInErp ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            }}
          >
            <span>💾</span>
            <span>{savingInErp ? 'Guardando en ERP...' : 'Registrar en Expediente'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
