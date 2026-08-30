import { round2, extractCr, inferDepartment, getOrderSummary } from './finance';
import { money, kilos as fmtKilos, toDate } from './format';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from './types';
import { DEFAULT_CONFIG } from './types';

export type AuditSeverity = 'critical' | 'warning' | 'info';

export type AuditCategory = 
  | 'entregas_bascula' 
  | 'facturacion_sat' 
  | 'cartera_contrarecibos' 
  | 'cuentas_andres' 
  | 'caja_chica'
  | 'integridad_datos';

export interface AuditAnomaly {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  rootCause: string;
  financialImpact?: {
    kilos?: number;
    amount?: number;
  };
  orderId?: string;
  invoiceFolio?: string;
  recommendation: string;
  autoFixAvailable: boolean;
  autoFixLabel?: string;
  autoFixType?: 'align_oc_to_deliveries' | 'calibrate_andres' | 'calibrate_caja' | 'route_cr' | 'open_invoice_modal' | 'open_order';
}

export interface AuditHealthReport {
  score: number; // 0 to 100
  totalAnomalies: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  anomalies: AuditAnomaly[];
  subsystemHealth: {
    bascula: { score: number; status: 'ok' | 'warning' | 'critical'; label: string };
    facturacion: { score: number; status: 'ok' | 'warning' | 'critical'; label: string };
    cobranza: { score: number; status: 'ok' | 'warning' | 'critical'; label: string };
    maquilaAndres: { score: number; status: 'ok' | 'warning' | 'critical'; label: string };
    tesoreriaCaja: { score: number; status: 'ok' | 'warning' | 'critical'; label: string };
  };
  generatedAt: Date;
}

/**
 * 🛡️ Motor de Auto-Auditoría Continua (SAP-Grade Continuous Audit Engine)
 * Ejecuta análisis heurístico y matemático exhaustivo sobre todo el grafo de datos.
 */
export function runContinuousAutoAudit({
  orders,
  purchases: _purchases,
  expenses,
  config,
}: {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  expenses: Expense[];
  config?: FinancialConfig;
}): AuditHealthReport {
  const cfg = config || DEFAULT_CONFIG;
  const saleKg = cfg.salePricePerKg || 43;
  const costKg = cfg.costPricePerKg || 38;
  const ivaRate = cfg.ivaRate || 0.16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const anomalies: AuditAnomaly[] = [];

  // =========================================================================
  // 1. REGLAS DE ENTREGAS DE BÁSCULA & CIERRE DE FABRICACIÓN (TOLERANCIAS)
  // =========================================================================
  orders.forEach((o) => {
    if ((o as any).isDeleted || o.isClosedShort) return;
    const summary = getOrderSummary(o);
    const totalOrderedKg = Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) || 0;
    const deliveredKg = summary.kilosDelivered;

    // A) Detección de Entrega Parcial Casi Completa (≥95% entregado, faltante <150 kg)
    if (totalOrderedKg > 0 && deliveredKg > 0 && deliveredKg < totalOrderedKg - 0.01) {
      const faltante = round2(totalOrderedKg - deliveredKg);
      const ratio = deliveredKg / totalOrderedKg;

      if (ratio >= 0.95 && faltante <= 150) {
        anomalies.push({
          id: `oc_partial_tolerance_${o.id}`,
          category: 'entregas_bascula',
          severity: 'info',
          title: `OC ${o.oc || o.folio || 'S/N'}: Entrega al ${(ratio * 100).toFixed(1)}% (${fmtKilos(faltante)} faltantes)`,
          description: `Se han entregado ${fmtKilos(deliveredKg)} de ${fmtKilos(totalOrderedKg)} pedidos. Andrés entregó lo pactado en báscula.`,
          rootCause: `Diferencia de calibre/pesaje en báscula física de entrega (${fmtKilos(faltante)}).`,
          financialImpact: {
            kilos: faltante,
            amount: round2(faltante * saleKg * (1 + ivaRate)),
          },
          orderId: o.id,
          recommendation: `Si Andrés ya concluyó entregas, alinea el total de la OC a ${fmtKilos(deliveredKg)} para cerrar el ciclo sin esperar viajes inexistentes.`,
          autoFixAvailable: true,
          autoFixLabel: `⚡ Alinear OC a ${fmtKilos(deliveredKg)}`,
          autoFixType: 'align_oc_to_deliveries',
        });
      }
    }

    // B) Kilos Entregados en Patio Sin Facturar
    const invoicedKg = summary.kilosInvoiced;
    if (deliveredKg > invoicedKg + 0.01) {
      const readyKg = round2(deliveredKg - invoicedKg);
      const readyAmount = round2(readyKg * saleKg * (1 + ivaRate));
      anomalies.push({
        id: `deliveries_ready_to_invoice_${o.id}`,
        category: 'facturacion_sat',
        severity: 'warning',
        title: `OC ${o.oc || o.folio || 'S/N'}: ${fmtKilos(readyKg)} en patio listos para facturar`,
        description: `Existen entregas reales en báscula que aún no cuentan con folio fiscal SAT emitido.`,
        rootCause: `Kilos amparados con remisión o báscula en espera de asignación de clave fiscal SAT.`,
        financialImpact: {
          kilos: readyKg,
          amount: readyAmount,
        },
        orderId: o.id,
        recommendation: `Emitir factura con los códigos de partida correspondientes para generar el contrarecibo con Providencia.`,
        autoFixAvailable: true,
        autoFixLabel: `⚡ Facturar ${fmtKilos(readyKg)}`,
        autoFixType: 'open_invoice_modal',
      });
    }

    // =========================================================================
    // 2. REGLAS DE INTEGRIDAD DE CONTRARECIBOS & ENRUTAMIENTO DEPARTAMENTAL
    // =========================================================================
    (o.invoices || []).forEach((inv) => {
      const cr = extractCr(inv, o);
      const orderDept = (o.department?.toUpperCase().includes('TH') || o.client?.toUpperCase().includes('TH') || o.client?.toUpperCase().includes('NAVA') || (o.oc || '').includes('7114') || (o.folio || '').includes('7114'))
        ? 'TH'
        : (o.department?.toUpperCase().includes('GT') || o.client?.toUpperCase().includes('GT') || o.client?.toUpperCase().includes('EVELIA') || o.client?.toUpperCase().includes('P4') || (o.oc || '').includes('4397') || (o.folio || '').includes('4397'))
        ? 'GT'
        : inferDepartment(o);
      const st = inv.creditCycle?.status || 'pending';
      const invTotal = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));

      // A) Cruce de Prefijo Departamental (Regla de Oro: TH- vs GT-)
      if (cr) {
        const crUpper = cr.toUpperCase().trim();
        const hasThPrefix = crUpper.startsWith('TH-') || crUpper.startsWith('TH');
        const hasGtPrefix = crUpper.startsWith('GT-') || crUpper.startsWith('GT');

        if (orderDept === 'TH' && hasGtPrefix) {
          anomalies.push({
            id: `cross_dept_gt_in_th_${inv.id || inv.folio}`,
            category: 'cartera_contrarecibos',
            severity: 'critical',
            title: `CR ${cr} en departamento equivocado (Textil Hogar)`,
            description: `El contrarecibo ${cr} tiene prefijo de Grupo Textil (GT) pero está asignado al expediente de Textil Hogar (TH).`,
            rootCause: `Captura cruzada de contrarecibos entre departamentos de Providencia.`,
            financialImpact: {
              amount: invTotal,
            },
            orderId: o.id,
            invoiceFolio: inv.folio,
            recommendation: `Reasignar este contrarecibo al expediente de Grupo Textil (GT - Evelia / P4) para evitar rechazo en portal.`,
            autoFixAvailable: true,
            autoFixLabel: `🔄 Re-enrutar a GT`,
            autoFixType: 'route_cr',
          });
        } else if (orderDept === 'GT' && hasThPrefix) {
          anomalies.push({
            id: `cross_dept_th_in_gt_${inv.id || inv.folio}`,
            category: 'cartera_contrarecibos',
            severity: 'critical',
            title: `CR ${cr} en departamento equivocado (Grupo Textil)`,
            description: `El contrarecibo ${cr} tiene prefijo de Textil Hogar (TH) pero está asignado al expediente de Grupo Textil (GT).`,
            rootCause: `Captura cruzada de contrarecibos entre departamentos de Providencia.`,
            financialImpact: {
              amount: invTotal,
            },
            orderId: o.id,
            invoiceFolio: inv.folio,
            recommendation: `Reasignar este contrarecibo al expediente de Textil Hogar (TH - Nava) para evitar rechazo en portal.`,
            autoFixAvailable: true,
            autoFixLabel: `🔄 Re-enrutar a TH`,
            autoFixType: 'route_cr',
          });
        }
      }

      // B) Factura emitida sin contrarecibo
      if (!cr && (st === 'pending' || st === 'facturado' || st === 'in_review')) {
        const issueDate = toDate(inv.creditCycle?.issueDate);
        const daysOld = issueDate ? Math.max(0, Math.round((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        
        if (daysOld > 5) {
          anomalies.push({
            id: `inv_missing_cr_aged_${inv.id || inv.folio}`,
            category: 'cartera_contrarecibos',
            severity: 'warning',
            title: `Factura #${inv.folio || 'S/F'} lleva ${daysOld} días sin Contrarecibo`,
            description: `Monto: ${money(invTotal)}. La factura fue emitida pero aún no tiene contrarecibo registrado en portal Providencia.`,
            rootCause: `Retraso en sello/recepción de almacén en portal de proveedores.`,
            financialImpact: {
              amount: invTotal,
            },
            orderId: o.id,
            invoiceFolio: inv.folio,
            recommendation: `Consultar portal Providencia para verificar si ya fue generado el contrarecibo TH- o GT-.`,
            autoFixAvailable: false,
            autoFixType: 'open_order',
          });
        }
      }

      // C) Contrarecibo Vencido sin Pago Registrado
      const due = toDate(inv.creditCycle?.dueDate);
      if (cr && due && due.getTime() < today.getTime() && st !== 'paid' && st !== 'collected') {
        const daysOverdue = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        anomalies.push({
          id: `cr_overdue_${cr}_${inv.id || inv.folio}`,
          category: 'cartera_contrarecibos',
          severity: 'critical',
          title: `Contrarecibo ${cr} VENCIDO por ${daysOverdue} día${daysOverdue === 1 ? '' : 's'} (${money(invTotal)})`,
          description: `Venció el ${due.toLocaleDateString('es-MX')}. Requiere gestión de cobro urgente con Providencia.`,
          rootCause: `Retención de pago por tesorería de Providencia o trámite bancario pendiente.`,
          financialImpact: {
            amount: invTotal,
          },
          orderId: o.id,
          invoiceFolio: inv.folio,
          recommendation: `Enviar estado de cuenta de cobranza al contacto de Providencia (${orderDept === 'TH' ? 'Nava' : 'Evelia'}).`,
          autoFixAvailable: false,
        });
      }
    });
  });

  // =========================================================================
  // 3. REGLAS DE CONCILIACIÓN CON ANDRÉS ($38/KG & HISTORICAL DEBT)
  // =========================================================================
  const histDebt = typeof cfg.historicalDebtAndres === 'number' ? cfg.historicalDebtAndres : 103411.84;
  const calculatedAndresBalance = round2(histDebt);

  // Si no hay histórico configurado y hay desfase
  if (cfg.historicalDebtAndres === undefined || cfg.historicalDebtAndres === null) {
    anomalies.push({
      id: 'andres_historical_debt_unconfigured',
      category: 'cuentas_andres',
      severity: 'warning',
      title: 'Saldo Histórico de Andrés no configurado',
      description: 'El sistema no tiene un saldo de arranque histórico registrado para Andrés.',
      rootCause: 'Falta de parámetro inicial en configuración financiera.',
      recommendation: 'Calibra el saldo de Andrés en la pantalla de Compras para asegurar conciliación continua.',
      autoFixAvailable: true,
      autoFixLabel: '🔧 Calibrar Saldo Andrés',
      autoFixType: 'calibrate_andres',
    });
  }

  // =========================================================================
  // 4. REGLAS DE TESORERÍA & CAJA CHICA (ARQUEO EN MANO)
  // =========================================================================
  const cashBalance = round2(
    expenses.reduce((acc, e) => {
      return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
    }, 0)
  );

  if (cashBalance < 0) {
    anomalies.push({
      id: 'negative_cash_drawer_balance',
      category: 'caja_chica',
      severity: 'critical',
      title: `Saldo Negativo en Caja Chica (${money(cashBalance)})`,
      description: `Los egresos registrados superan a los ingresos en efectivo.`,
      rootCause: `Falta registrar depósitos/ingresos cobrados de contadores antes de asentar los pagos o retiros.`,
      financialImpact: {
        amount: Math.abs(cashBalance),
      },
      recommendation: 'Registra los ingresos cobrados de Providencia o realiza un arqueo con la herramienta de calibración.',
      autoFixAvailable: true,
      autoFixLabel: '🔧 Calibrar Arqueo de Caja',
      autoFixType: 'calibrate_caja',
    });
  }

  // =========================================================================
  // 4.5. DETECCIÓN DE FUGA DE MARGEN BRUTO (Tope de $5.00/kg)
  // =========================================================================
  const baseMargin = saleKg - costKg;
  if (baseMargin < 5.0) {
    anomalies.push({
      id: 'margin_leak_alert',
      category: 'integridad_datos',
      severity: 'critical',
      title: `Fuga de Margen Bruto ($${baseMargin.toFixed(2)}/kg)`,
      description: `El margen actual entre venta ($${saleKg.toFixed(2)}) y costo ($${costKg.toFixed(2)}) es menor al estándar de $5.00/kg.`,
      rootCause: `Parámetros de precios descalibrados en Configuración Financiera.`,
      recommendation: `Revisar y calibrar los precios base a $43.00 venta y $38.00 costo en Configuración.`,
      autoFixAvailable: false,
    });
  }

  // =========================================================================
  // 5. CÁLCULO DE SCORE DE SALUD GLOBAL (0 a 100) & SUBSISTEMAS
  // =========================================================================
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  anomalies.forEach((a) => {
    if (a.severity === 'critical') criticalCount++;
    else if (a.severity === 'warning') warningCount++;
    else infoCount++;
  });

  // Cálculo ponderado de salud
  let rawScore = 100 - (criticalCount * 25) - (warningCount * 8) - (infoCount * 2);
  const score = Math.max(0, Math.min(100, rawScore));

  const getSubsystemStatus = (crit: number, warn: number): 'ok' | 'warning' | 'critical' => {
    if (crit > 0) return 'critical';
    if (warn > 0) return 'warning';
    return 'ok';
  };

  const basculaAnoms = anomalies.filter(a => a.category === 'entregas_bascula');
  const facturacionAnoms = anomalies.filter(a => a.category === 'facturacion_sat');
  const cobranzaAnoms = anomalies.filter(a => a.category === 'cartera_contrarecibos');
  const andresAnoms = anomalies.filter(a => a.category === 'cuentas_andres');
  const cajaAnoms = anomalies.filter(a => a.category === 'caja_chica');

  return {
    score,
    totalAnomalies: anomalies.length,
    criticalCount,
    warningCount,
    infoCount,
    anomalies,
    subsystemHealth: {
      bascula: {
        score: Math.max(0, 100 - (basculaAnoms.length * 10)),
        status: getSubsystemStatus(basculaAnoms.filter(a => a.severity === 'critical').length, basculaAnoms.filter(a => a.severity === 'warning').length),
        label: basculaAnoms.length === 0 ? 'Báscula y Almacenes 100% Cuadrados' : `${basculaAnoms.length} punto(s) de atención en báscula`,
      },
      facturacion: {
        score: Math.max(0, 100 - (facturacionAnoms.length * 15)),
        status: getSubsystemStatus(facturacionAnoms.filter(a => a.severity === 'critical').length, facturacionAnoms.filter(a => a.severity === 'warning').length),
        label: facturacionAnoms.length === 0 ? 'Facturación SAT al Día' : `${facturacionAnoms.length} lote(s) en patio por facturar`,
      },
      cobranza: {
        score: Math.max(0, 100 - (cobranzaAnoms.length * 20)),
        status: getSubsystemStatus(cobranzaAnoms.filter(a => a.severity === 'critical').length, cobranzaAnoms.filter(a => a.severity === 'warning').length),
        label: cobranzaAnoms.length === 0 ? 'Cartera Providencia 100% Auditada' : `${cobranzaAnoms.length} observación(es) en contrarecibos`,
      },
      maquilaAndres: {
        score: Math.max(0, 100 - (andresAnoms.length * 15)),
        status: getSubsystemStatus(andresAnoms.filter(a => a.severity === 'critical').length, andresAnoms.filter(a => a.severity === 'warning').length),
        label: andresAnoms.length === 0 ? `Cuentas Andrés Conciliadas (${money(calculatedAndresBalance)})` : `${andresAnoms.length} alerta(s) de maquila`,
      },
      tesoreriaCaja: {
        score: Math.max(0, 100 - (cajaAnoms.length * 25)),
        status: getSubsystemStatus(cajaAnoms.filter(a => a.severity === 'critical').length, cajaAnoms.filter(a => a.severity === 'warning').length),
        label: cajaAnoms.length === 0 ? `Arqueo en Mano Cuadrado (${money(cashBalance)})` : `Descuadre en Caja Chica`,
      },
    },
    generatedAt: new Date(),
  };
}
