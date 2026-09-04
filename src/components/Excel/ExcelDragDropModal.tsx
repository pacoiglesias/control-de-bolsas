import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { collection, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrdersContext } from '../../context/OrdersContext';
import { downloadOfficialExcelTemplate } from '../../lib/excelTemplateGenerator';
import { validarTamanoExcel } from '../../lib/xlsxSafety';
import { computeFinancials, round2 } from '../../lib/finance';
import { kilos } from '../../lib/format';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import type { PurchaseOrder } from '../../lib/types';

interface ExcelDragDropModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedExcelRow {
  rowIndex: number;
  oc: string;
  client: string;
  department: string;
  codeSat: string;
  itemDescription: string;
  kilosPedidos: number;
  precioVenta: number;
  precioCosto: number;
  kilosEntregados: number;
  folioFactura: string;
  contrarecibo: string;
  fechaEmision: string;
  fechaVencimiento: string;
  estatusCobro: string;
  notas: string;
  isValid: boolean;
  warning?: string;
}

export const ExcelDragDropModal: React.FC<ExcelDragDropModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const { orders } = useOrdersContext();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'create_or_merge' | 'update_only'>('create_or_merge');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalizar encabezados para búsqueda flexible
  const normalizeKey = (key: string) => {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Convertir fecha de Excel (serial numérico o string) a string AAAA-MM-DD
  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === 'number') {
      // Serial date de Excel
      const dateObj = new Date((val - 25569) * 86400 * 1000);
      return dateObj.toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashMatch) {
      const d = slashMatch[1].padStart(2, '0');
      const m = slashMatch[2].padStart(2, '0');
      const y = slashMatch[3];
      return `${y}-${m}-${d}`;
    }
    return str;
  };

  const processFile = useCallback(async (file: File) => {
    const errorTamano = validarTamanoExcel(file);
    if (errorTamano) {
      toast(errorTamano, 'bad');
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      // Tomar la primera hoja o la que contenga "captura" / "ordenes"
      const sheetName = wb.SheetNames.find(n => /captura|orden|expediente|datos/i.test(n)) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rawJson || rawJson.length === 0) {
        toast('El archivo Excel está vacío o no tiene filas válidas.', 'bad');
        setIsProcessing(false);
        return;
      }

      const rows: ParsedExcelRow[] = [];

      rawJson.forEach((rawRow, idx) => {
        // Mapear dinámicamente buscando sinónimos
        const rowMap: Record<string, any> = {};
        Object.keys(rawRow).forEach(k => {
          rowMap[normalizeKey(k)] = rawRow[k];
        });

        const oc = String(
          rowMap['foliooc'] || rowMap['oc'] || rowMap['ordencompra'] || rowMap['ordendecompra'] || rowMap['pedido'] || rowMap['folio'] || ''
        ).trim().toUpperCase();

        // Ignorar filas totalmente vacías
        if (!oc && !rowMap['descripcionbolsa'] && !rowMap['kilospedidos']) return;

        let client = String(rowMap['cliente'] || rowMap['razonsocial'] || '').trim();
        if (/textil\s*hogar|nava/i.test(client) || oc.includes('14114')) {
          client = 'TEXTIL HOGAR (TH - NAVA)';
        } else if (/grupo\s*textil|providencia|evelia|p4/i.test(client) || oc.includes('39713')) {
          client = 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)';
        } else if (!client) {
          client = 'GRUPO TEXTIL PROVIDENCIA';
        }

        let department = String(rowMap['departamento'] || rowMap['depto'] || '').trim();
        if (!department) {
          department = client.includes('TEXTIL HOGAR') ? 'TH-ALMACEN-1' : 'P4-ALM';
        }

        const codeSat = String(rowMap['clavesat'] || rowMap['sat'] || '24141500').trim();
        const itemDescription = String(rowMap['descripcionbolsa'] || rowMap['descripcion'] || rowMap['producto'] || 'BOLSA POLIETILENO').trim();
        const kilosPedidos = Number(rowMap['kilospedidos'] || rowMap['kilos'] || rowMap['cantidad'] || 0);
        const precioVenta = Number(rowMap['precioventakg'] || rowMap['precioventa'] || rowMap['precio'] || 43.00);
        const precioCosto = Number(rowMap['preciocostoandreskg'] || rowMap['preciocosto'] || rowMap['costo'] || 38.00);
        const kilosEntregados = Number(rowMap['kilosentregadosbascula'] || rowMap['kilosentregados'] || rowMap['entregado'] || 0);
        const folioFactura = String(rowMap['foliofacturacfdi'] || rowMap['foliofactura'] || rowMap['factura'] || '').trim();
        const contrarecibo = String(rowMap['contrarecibocr'] || rowMap['contrarecibo'] || rowMap['cr'] || '').trim().toUpperCase();

        const fechaEmision = parseExcelDate(rowMap['fechaemisionyyyy_mm_dd'] || rowMap['fechaemision'] || rowMap['fecha']);
        const fechaVencimiento = parseExcelDate(rowMap['fechavencimientoyyyy_mm_dd'] || rowMap['fechavencimiento'] || rowMap['vencimiento']);
        const estatusCobro = String(rowMap['estatuscobro'] || rowMap['estatus'] || rowMap['estado'] || 'En Proceso').trim();
        const notas = String(rowMap['notasoperativas'] || rowMap['notas'] || rowMap['observaciones'] || '').trim();

        const isValid = oc.length > 0 && kilosPedidos > 0;
        let warning: string | undefined;

        if (!isValid) {
          warning = !oc ? 'Falta el Folio de OC' : 'Kilos pedidos en 0';
        } else if (kilosEntregados > kilosPedidos) {
          warning = `Entregado (${kilosEntregados} kg) supera OC (${kilosPedidos} kg)`;
        }

        rows.push({
          rowIndex: idx + 2,
          oc,
          client,
          department,
          codeSat,
          itemDescription,
          kilosPedidos,
          precioVenta,
          precioCosto,
          kilosEntregados,
          folioFactura,
          contrarecibo,
          fechaEmision: fechaEmision || new Date().toISOString().slice(0, 10),
          fechaVencimiento,
          estatusCobro,
          notas,
          isValid,
          warning,
        });
      });

      setParsedRows(rows);
      sound.playSuccess();
      toast(`✅ Leídas ${rows.length} filas del archivo "${file.name}"`, 'ok');
    } catch (err: any) {
      console.error(err);
      toast(`Error al leer archivo Excel: ${err.message || 'Formato no soportado'}`, 'bad');
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (/\.(xlsx|xls|csv)$/i.test(droppedFile.name)) {
        processFile(droppedFile);
      } else {
        toast('Por favor arrastra un archivo de Excel (.xlsx, .xls) o .csv válido.', 'bad');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Sincronizar / Importar a Firestore
  const handleImportBatch = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast('No hay filas válidas para importar.', 'bad');
      return;
    }

    setIsProcessing(true);
    try {
      // Agrupar filas por OC
      const ocGroups = new Map<string, ParsedExcelRow[]>();
      validRows.forEach(r => {
        const list = ocGroups.get(r.oc) || [];
        list.push(r);
        ocGroups.set(r.oc, list);
      });

      const batch = writeBatch(db);
      let updatedCount = 0;
      let createdCount = 0;

      for (const [ocKey, groupRows] of ocGroups.entries()) {
        const firstRow = groupRows[0];
        const existingOrder = orders.find(o => o.oc === ocKey || o.folio === ocKey);

        const totalKilos = groupRows.reduce((acc, r) => acc + r.kilosPedidos, 0);
        const totalDelivered = groupRows.reduce((acc, r) => acc + r.kilosEntregados, 0);

        // Construir partidas
        const items = groupRows.map((r, iIdx) => ({
          id: `item-${iIdx + 1}`,
          code: r.codeSat,
          description: r.itemDescription,
          quantity: r.kilosPedidos,
          unitPrice: r.precioVenta,
          amount: round2(r.kilosPedidos * r.precioVenta),
          unit: 'Kilos',
        }));

        // Entregas si hay báscula
        const deliveries = totalDelivered > 0 ? [{
          id: `del-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          date: Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())),
          kilograms: totalDelivered,
          notes: firstRow.notas || 'Importado vía Excel',
        }] : [];

        // Facturas si hay folio
        const invoices = firstRow.folioFactura ? [{
          id: `inv-${firstRow.folioFactura.toLowerCase()}`,
          folio: firstRow.folioFactura,
          kilos: totalDelivered > 0 ? totalDelivered : totalKilos,
          creditCycle: {
            status: firstRow.contrarecibo ? 'pending' : 'facturado',
            issueDate: Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())),
            dueDate: firstRow.fechaVencimiento ? Timestamp.fromDate(new Date(firstRow.fechaVencimiento)) : null,
          },
          collection: {
            contrareciboNumber: firstRow.contrarecibo || '',
            contrareciboDate: firstRow.contrarecibo ? Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())) : null,
            paidAmount: /pagad|cobrad/i.test(firstRow.estatusCobro) ? round2(totalKilos * firstRow.precioVenta * 1.16) : 0,
          },
          financials: {
            subtotal: round2(totalKilos * firstRow.precioVenta),
            iva: round2(totalKilos * firstRow.precioVenta * 0.16),
            invoiceTotal: round2(totalKilos * firstRow.precioVenta * 1.16),
            commission: round2(totalKilos * firstRow.precioVenta * 0.08),
          },
        }] : [];

        if (existingOrder) {
          // Actualizar orden existente
          const orderRef = doc(db, PATHS.orders, existingOrder.id);
          const updatePayload: any = {
            updatedAt: serverTimestamp(),
            customCostPrice: firstRow.precioCosto || 38.00,
          };

          if (deliveries.length > 0 && (!existingOrder.deliveries || existingOrder.deliveries.length === 0)) {
            updatePayload.deliveries = deliveries;
          }
          if (invoices.length > 0 && (!existingOrder.invoices || existingOrder.invoices.length === 0)) {
            updatePayload.invoices = invoices;
          }
          if (firstRow.contrarecibo && !existingOrder.collection?.contrareciboNumber) {
            updatePayload['collection.contrareciboNumber'] = firstRow.contrarecibo;
          }

          batch.update(orderRef, updatePayload);
          updatedCount++;
        } else if (importMode === 'create_or_merge') {
          // Crear nueva orden
          const newDocRef = doc(collection(db, PATHS.orders));
          const financials = computeFinancials(totalKilos, {
            salePricePerKg: firstRow.precioVenta || 43.00,
            costPricePerKg: firstRow.precioCosto || 38.00,
            commissionRate: 0.08,
            creditDays: 30,
            ivaRate: 0.16,
            commissionBase: 'subtotal',
          });

          const newOrderPayload: Partial<PurchaseOrder> = {
            id: newDocRef.id,
            oc: firstRow.oc,
            folio: firstRow.oc,
            client: firstRow.client,
            department: firstRow.department,
            totalKilograms: totalKilos,
            customCostPrice: firstRow.precioCosto || 38.00,
            items: items as any,
            deliveries: deliveries as any,
            invoices: invoices as any,
            financials,
            creditCycle: {
              status: invoices.length > 0 ? (firstRow.contrarecibo ? 'pending' : 'facturado') : 'pedido',
              issueDate: Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())),
              dueDate: firstRow.fechaVencimiento ? Timestamp.fromDate(new Date(firstRow.fechaVencimiento)) : null,
            },
            collection: {
              contrareciboNumber: firstRow.contrarecibo || '',
              contrareciboDate: firstRow.contrarecibo ? Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())) : null,
              paidAmount: /pagad|cobrad/i.test(firstRow.estatusCobro) ? financials.invoiceTotal : 0,
            },
            processedAt: Timestamp.fromDate(new Date(firstRow.fechaEmision || Date.now())),
            updatedAt: serverTimestamp() as any,
          };

          batch.set(newDocRef, newOrderPayload);
          createdCount++;
        }
      }

      await batch.commit();

      confetti({ particleCount: 60, spread: 55, origin: { y: 0.7 } });
      sound.playChaChing();
      toast(`🚀 Éxito: ${createdCount} órdenes creadas y ${updatedCount} actualizadas desde Excel`, 'ok');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast(`Error al guardar en Firestore: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--paper, #1e293b)',
          border: '1px solid var(--line, rgba(255,255,255,0.15))',
          borderRadius: 16,
          width: '100%',
          maxWidth: 950,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--line, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📂</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Importación y Sincronización Excel (.xlsx)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft, #94a3b8)' }}>
                Arrastra tu archivo o descarga la plantilla oficial preconfigurada
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => downloadOfficialExcelTemplate()}
              className="btn"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📥 Descargar Plantilla Oficial
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-soft, #94a3b8)',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Zona Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragging ? '2px dashed #3b82f6' : '2px dashed var(--line, rgba(255,255,255,0.2))',
              borderRadius: 12,
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {isDragging ? '¡Suelta el archivo aquí!' : 'Arrastra y suelta tu archivo Excel aquí'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #94a3b8)' }}>
              o haz clic para explorar en tu computadora (.xlsx, .xls, .csv hasta 15MB)
            </div>
            {fileName && (
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1e3a8a', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
                📄 Archivo cargado: {fileName} ({parsedRows.length} filas detectadas)
              </div>
            )}
          </div>

          {/* Opciones de Importación */}
          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-sunk)', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Modo de Sincronización:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="create_or_merge"
                    checked={importMode === 'create_or_merge'}
                    onChange={() => setImportMode('create_or_merge')}
                  />
                  <span>➕ Crear Nuevas y Actualizar Existentes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="update_only"
                    checked={importMode === 'update_only'}
                    onChange={() => setImportMode('update_only')}
                  />
                  <span>🔄 Solo Actualizar Existentes</span>
                </label>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Válidas: <strong style={{ color: '#10b981' }}>{parsedRows.filter(r => r.isValid).length}</strong> / {parsedRows.length}
              </div>
            </div>
          )}

          {/* Tabla de Pre-Visualización */}
          {parsedRows.length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-sunk)', zIndex: 2 }}>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Folio OC</th>
                      <th>Cliente</th>
                      <th>Partida / Bolsa</th>
                      <th className="num">Kilos Pedidos</th>
                      <th className="num">Entregado</th>
                      <th>Factura</th>
                      <th>Contrarecibo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r) => (
                      <tr key={r.rowIndex} style={{ opacity: r.isValid ? 1 : 0.6 }}>
                        <td>{r.rowIndex}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{r.oc || '—'}</td>
                        <td>{r.client}</td>
                        <td>{r.itemDescription}</td>
                        <td className="num mono">{kilos(r.kilosPedidos)}</td>
                        <td className="num mono">{r.kilosEntregados > 0 ? kilos(r.kilosEntregados) : '—'}</td>
                        <td className="mono">{r.folioFactura || '—'}</td>
                        <td className="mono">{r.contrarecibo || '—'}</td>
                        <td>
                          {r.isValid ? (
                            <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Listo</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 700 }} title={r.warning}>
                              ⚠️ {r.warning}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--line, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
          }}
        >
          <button
            onClick={onClose}
            className="btn"
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
          >
            Cancelar
          </button>

          <button
            onClick={handleImportBatch}
            disabled={isProcessing || parsedRows.filter(r => r.isValid).length === 0}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: isProcessing || parsedRows.filter(r => r.isValid).length === 0 ? 0.5 : 1,
            }}
          >
            {isProcessing ? 'Sincronizando...' : `🚀 Aplicar e Importar ${parsedRows.filter(r => r.isValid).length} Registros`}
          </button>
        </div>
      </div>
    </div>
  );
};
