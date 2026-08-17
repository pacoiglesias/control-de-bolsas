import { useState, useMemo } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { Modal, Field } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useExpenses } from '../../hooks/useExpenses';
import { useOrders } from '../../hooks/useOrders';
import { usePurchases } from '../../hooks/usePurchases';
import { useConfig } from '../../hooks/useConfig';
import { toInputDate, fromInputDate, money } from '../../lib/format';
import { confirmDialog } from '../../lib/confirmDialog';
import { computeCommissionFromInvoiceTotal, normalizarTexto } from '../../lib/finance';
import { useAuth } from '../../context/AuthContext';
import { logAction } from '../../lib/logger';
import { openWhatsAppMessage } from '../../lib/whatsappReminder';
import { generateAndresReceiptPdf, printAndresReceipt } from '../../lib/andresReceiptPdf';
import Decimal from 'decimal.js';

export function PagarAndresModal({ 
  onClose,
  initialAmount = 0
}: { 
  onClose: () => void;
  initialAmount?: number;
}) {
  const { expenses } = useExpenses();
  const { orders } = useOrders();
  const { purchases: allPurchases } = usePurchases();
  const { config } = useConfig();
  const { user } = useAuth();
  const toast = useToast();

  const saldoCaja = useMemo(() => {
    return expenses.reduce((acc, e) => {
      return new Decimal(acc).plus(e.type === 'ingreso' ? e.amount : -e.amount).toNumber();
    }, 0);
  }, [expenses]);

  const deudaConAndres = useMemo(() => {
    const provPurchases = allPurchases.filter(p => normalizarTexto(p.provider) === 'andres');
    const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0);
    const currentCostPerKg = config?.costPricePerKg || 42;
    const totalPurchasesCost = totalReceivedKilos * currentCostPerKg;

    const provExpenses = expenses.filter(e => normalizarTexto(e.provider) === 'andres');
    const totalPagado = provExpenses.reduce((acc, e) => {
      if (e.type === 'egreso') return acc + e.amount;
      if (e.type === 'ingreso') return acc - e.amount;
      return acc;
    }, 0);

    const deudaHistorica = config?.historicalDebtAndres || 0;
    const saldoProveedor = totalPagado - totalPurchasesCost + deudaHistorica;
    return saldoProveedor < 0 ? Math.abs(saldoProveedor) : 0;
  }, [allPurchases, expenses, config]);

  const dineroConContador = useMemo(() => {
    let neto = 0;
    orders.forEach((o) => {
      (o.invoices || []).forEach((inv) => {
        if (inv.creditCycle?.status === 'paid') {
          const tot = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const comm = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(tot, config as any);
          neto += (tot - comm);
        }
      });
    });
    return neto;
  }, [orders, config]);

  const [pagoAbono, setPagoAbono] = useState({ 
    amount: initialAmount > 0 ? initialAmount.toString() : '', 
    concept: initialAmount > 0 ? 'Liquidación de Saldo Pendiente' : 'Abono a Cuenta / Anticipo', 
    date: toInputDate(new Date()) 
  });
  const [busy, setBusy] = useState(false);

  const montoNum = Number(pagoAbono.amount) || 0;
  const saldoRestante = new Decimal(saldoCaja).minus(montoNum).toNumber();
  const saldoInsuficiente = montoNum > saldoCaja;

  const handlePrintReceipt = (overrideAmount?: number) => {
    const amt = overrideAmount ?? montoNum;
    if (amt <= 0) return toast('Ingresa un monto para imprimir el recibo.', 'bad');
    printAndresReceipt({
      amount: amt,
      concept: pagoAbono.concept.trim() || 'Abono por Maquila y Fabricación de Bolsa',
      date: pagoAbono.date,
      saldoAnterior: deudaConAndres,
      saldoRestante: Math.max(0, deudaConAndres - amt),
      payerName: user?.email || 'Administración / Socios Providencia',
    });
  };

  const handleDownloadReceiptPdf = async () => {
    if (montoNum <= 0) return toast('Ingresa un monto para descargar el recibo.', 'bad');
    try {
      await generateAndresReceiptPdf({
        amount: montoNum,
        concept: pagoAbono.concept.trim() || 'Abono por Maquila y Fabricación de Bolsa',
        date: pagoAbono.date,
        saldoAnterior: deudaConAndres,
        saldoRestante: Math.max(0, deudaConAndres - montoNum),
        payerName: user?.email || 'Administración / Socios Providencia',
      });
      toast('📄 Recibo PDF descargado exitosamente.', 'ok');
    } catch {
      toast('No se pudo generar el PDF del recibo.', 'bad');
    }
  };

  const handleSendWhatsAppReceipt = () => {
    if (montoNum <= 0) return toast('Ingresa un monto para generar el comprobante.', 'bad');
    const msg = `Hola estimado Andrés,\n\nTe comparto el comprobante del pago registrado el día de hoy:\n\n💰 *Importe:* ${money(montoNum)}\n📋 *Concepto:* ${pagoAbono.concept.trim() || 'Abono a Cuenta'}\n📅 *Fecha:* ${pagoAbono.date}\n\nQuedamos al pendiente. Saludos, Bolsas Elemental.`;
    openWhatsAppMessage(msg);
  };

  async function registrarAbono(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    
    const val = Number(pagoAbono.amount);
    if (isNaN(val) || val <= 0) return toast('El monto debe ser mayor a cero.', 'bad');
    if (!pagoAbono.concept.trim()) return toast('El concepto es obligatorio.', 'bad');
    
    if (val > saldoCaja) {
      const msg = `⚠️ ATENCIÓN: El saldo en efectivo en Caja Chica es de ${money(saldoCaja)}, pero deseas pagar ${money(val)} a Andrés.\n\nLa caja quedará en saldo negativo de ${money(saldoRestante)}.\n\n¿Estás completamente seguro de autorizar este pago?`;
      if (!(await confirmDialog({ message: msg, danger: true }))) return;
    } else {
      if (!(await confirmDialog({ message: `¿Confirmas registrar un pago/abono de ${money(val)} a Andrés saliendo de Caja Chica?` }))) return;
    }
    
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        amount: val,
        concept: pagoAbono.concept.trim(),
        date: fromInputDate(pagoAbono.date)?.getTime() || Date.now(),
        provider: 'Andrés',
        type: 'egreso'
      });

      await logAction(user?.email, 'Pago a Andrés Registrado', {
        amount: val,
        concept: pagoAbono.concept.trim(),
        date: pagoAbono.date,
        saldoRestanteCaja: saldoRestante,
      });

      toast(`✅ Pago por ${money(val)} a Andrés registrado con éxito.`, 'ok');

      if (await confirmDialog({ message: `✅ Pago por ${money(val)} registrado con éxito.\n\n¿Deseas imprimir el Recibo Oficial para que Andrés te lo firme en este momento?` })) {
        handlePrintReceipt(val);
      }

      onClose();
    } catch (err: any) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="💳 Pagar o Adelantar Dinero a Andrés" onClose={onClose}>
      <form onSubmit={registrarAbono} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Panel Informativo de Efectivo en Caja */}
        <div
          style={{
            background: saldoInsuficiente ? 'rgba(239, 68, 68, 0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${saldoInsuficiente ? '#ef4444' : 'var(--line)'}`,
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
              💵 Saldo Disponible en Caja Chica:
            </span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: saldoCaja < 0 ? '#dc2626' : '#059669' }}>
              {money(saldoCaja)}
            </span>
          </div>

          {montoNum > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                📉 Saldo Restante tras este Pago:
              </span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: saldoRestante < 0 ? '#dc2626' : '#059669' }}>
                {money(saldoRestante)}
              </span>
            </div>
          )}

          {saldoInsuficiente && montoNum > 0 && (
            <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 11.5, color: '#991b1b', lineHeight: 1.4 }}>
              <strong>⚠️ Saldo Insuficiente:</strong> No hay suficiente efectivo en Caja Chica para cubrir este pago.
              {dineroConContador > 0 && (
                <div style={{ marginTop: 4, color: '#1e40af' }}>
                  💡 <strong>Tip:</strong> Tienes <strong>{money(dineroConContador)}</strong> pendientes por recoger con el contador. Pasa ese dinero a caja primero antes de pagar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones de Presets Rápidos de 1 Clic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            ⚡ Presets Rápidos (1 Toque):
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {deudaConAndres > 0 && (() => {
              const paso = deudaConAndres > 100000 ? 50000 : deudaConAndres > 20000 ? 10000 : 5000;
              const proximoRedondeo = Math.ceil((deudaConAndres + 1) / paso) * paso;
              const tieneAdelanto = proximoRedondeo > deudaConAndres;

              return (
                <>
                  <button
                    type="button"
                    className="chip active"
                    style={{ fontSize: 11, padding: '4px 10px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
                    onClick={() => setPagoAbono({ ...pagoAbono, amount: deudaConAndres.toFixed(2), concept: 'Liquidación Total de Saldo' })}
                  >
                    💰 Liquidar Deuda: {money(deudaConAndres)}
                  </button>

                  {tieneAdelanto && (
                    <button
                      type="button"
                      className="chip"
                      style={{ fontSize: 11, padding: '4px 10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setPagoAbono({ ...pagoAbono, amount: proximoRedondeo.toFixed(2), concept: `Liquidación + Adelanto ($${(proximoRedondeo - deudaConAndres).toLocaleString()} a favor)` })}
                    >
                      🚀 Liquidar + Adelanto: {money(proximoRedondeo)} (+{money(proximoRedondeo - deudaConAndres)})
                    </button>
                  )}

                  <button
                    type="button"
                    className="chip"
                    style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
                    onClick={() => setPagoAbono({ ...pagoAbono, amount: (deudaConAndres / 2).toFixed(2), concept: '50% de Saldo Pendiente' })}
                  >
                    💵 50% Deuda: {money(deudaConAndres / 2)}
                  </button>
                </>
              );
            })()}
            {saldoCaja > 0 && (
              <button
                type="button"
                className="chip"
                style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer', background: 'rgba(16,185,129,0.1)', color: '#047857', borderColor: '#10b981' }}
                onClick={() => setPagoAbono({ ...pagoAbono, amount: saldoCaja.toFixed(2), concept: 'Abono con Total de Caja Chica' })}
              >
                💵 Todo el Efectivo en Caja: {money(saldoCaja)}
              </button>
            )}
          </div>
        </div>

        {/* Indicador de Adelanto a Favor de Andrés */}
        {montoNum > deudaConAndres && deudaConAndres > 0 && (
          <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', borderRadius: 10, fontSize: 12, color: '#047857', lineHeight: 1.4 }}>
            ✨ <strong>¡Excelente pago!</strong> Este importe de <strong>{money(montoNum)}</strong> liquida la deuda con Andrés al 100% y le deja un <strong>adelanto a tu favor de {money(montoNum - deudaConAndres)}</strong> (cubriendo ~{Math.round((montoNum - deudaConAndres) / (config?.costPricePerKg || 42)).toLocaleString()} kg de entregas futuras).
          </div>
        )}

        <Field label="Monto a Pagar a Andrés ($)" full>
          <input 
            type="number" 
            step="0.01" 
            min="0.01"
            value={pagoAbono.amount}
            onChange={(e) => setPagoAbono({ ...pagoAbono, amount: e.target.value })}
            autoFocus 
            required 
            placeholder="Ej. 100000"
            style={{ fontSize: 18, fontWeight: 800, padding: '10px 14px' }}
          />
        </Field>

        {/* ─── CÁLCULO AUTOMÁTICO DE KILOS AMPARADOS A PRECIO DE COSTO ─── */}
        {montoNum > 0 && (() => {
          const currentCost = config?.costPricePerKg || 42;
          const currentSale = config?.salePricePerKg || 43;
          const ivaRate = config?.ivaRate || 0.16;
          const kilosAmparados = montoNum / currentCost;
          const bultosEst = Math.round(kilosAmparados / 25);
          const valorVentaSinIva = kilosAmparados * currentSale;
          const valorVentaConIva = valorVentaSinIva * (1 + ivaRate);

          return (
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(16,185,129,0.08) 100%)',
                border: '1px solid rgba(37,99,235,0.25)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  ⚖️ Kilos que Andrés ampara (@ ${currentCost.toFixed(2)}/kg):
                </span>
                <span className="mono" style={{ fontSize: 19, fontWeight: 900, color: '#2563eb' }}>
                  {kilosAmparados.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, borderTop: '1px dashed var(--line-soft)', paddingTop: 8, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                <div>
                  📦 Bultos est. (25kg): <strong style={{ color: 'var(--ink)' }}>~{bultosEst.toLocaleString()} bultos</strong>
                </div>
                <div>
                  🏢 Venta Providencia (@ ${currentSale.toFixed(2)}): <strong style={{ color: '#047857' }}>{money(valorVentaConIva)} con IVA</strong>
                </div>
              </div>
            </div>
          );
        })()}
        
        <Field label="Concepto / Motivo" full>
          <input 
            type="text"
            value={pagoAbono.concept}
            onChange={(e) => setPagoAbono({ ...pagoAbono, concept: e.target.value })}
            required
            placeholder="Ej. Abono por fabricación de bolsas..."
          />
        </Field>
        
        <Field label="Fecha del Pago" full>
          <input 
            type="date"
            value={pagoAbono.date}
            onChange={(e) => setPagoAbono({ ...pagoAbono, date: e.target.value })}
            required
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          {montoNum > 0 && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => handlePrintReceipt()}
                style={{ background: 'rgba(37,99,235,0.1)', color: '#1d4ed8', borderColor: '#3b82f6', fontWeight: 700 }}
                title="Imprimir formato de recibo en papel para firma de recibido de Andrés"
              >
                🖨️ Imprimir Recibo
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDownloadReceiptPdf}
                style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderColor: '#8b5cf6', fontWeight: 700 }}
                title="Descargar recibo en formato PDF"
              >
                📄 Recibo PDF
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSendWhatsAppReceipt}
                style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', borderColor: '#10b981', fontWeight: 700 }}
                title="Redactar comprobante de abono para enviar a Andrés por WhatsApp"
              >
                💬 WhatsApp
              </button>
            </>
          )}
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              background: saldoInsuficiente ? '#ef4444' : 'var(--ok)', 
              borderColor: saldoInsuficiente ? '#dc2626' : 'var(--ok)', 
              color: '#fff',
              fontWeight: 800,
            }} 
            disabled={busy}
          >
            {busy ? 'Procesando...' : saldoInsuficiente ? '⚠️ Registrar Pago (Caja Negativa)' : '💰 Registrar Pago a Andrés'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

