import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { glass } from './MaquiladorPortal.shared';

/**
 * FIX (v8.9.9, auditoría Staff Engineer -- contraste WCAG AA): el texto
 * secundario usaba blanco al 30%/40% de opacidad sobre fondo oscuro, muy por
 * debajo del contraste mínimo AA (4.5:1) -- este portal es el único flujo
 * con usuario externo (Andrés, sin cuenta de Firebase, en campo con luz
 * solar), así que la legibilidad aquí pesa más que en el resto de la app.
 * Subido a 60%/65%.
 *
 * FIX (v8.9.8, split de MaquiladorPortal.tsx — ~1530 lineas): tab "Registrar
 * Entrega" extraido tal cual, sin cambiar logica. A diferencia de Cobranza,
 * este componente no tenia un Context propio -- se extrae con props
 * explicitas en vez de crear uno nuevo solo para 3 archivos. `selectedOrder`,
 * `numKilos` e `isOverDelivery` son valores derivados que ya se calculaban
 * en el padre (no son estado propio de este tab), asi que se quedan alla y
 * se pasan aqui listos.
 */
export default function MaquiladorPortalEntregaTab({
  deptFilter,
  setDeptFilter,
  searchOc,
  setSearchOc,
  filteredOrders,
  orderId,
  setOrderId,
  kilos,
  setKilos,
  selectedOrder,
  showBundleCalc,
  setShowBundleCalc,
  bundleCount,
  setBundleCount,
  bundleWeight,
  setBundleWeight,
  isOverDelivery,
  numKilos,
  docType,
  setDocType,
  docFolio,
  setDocFolio,
  deliveryNotes,
  setDeliveryNotes,
  saving,
  handleSubmit,
}: {
  deptFilter: 'ALL' | 'TH' | 'GT';
  setDeptFilter: (d: 'ALL' | 'TH' | 'GT') => void;
  searchOc: string;
  setSearchOc: (s: string) => void;
  filteredOrders: any[];
  orderId: string;
  setOrderId: (id: string) => void;
  kilos: string;
  setKilos: (k: string) => void;
  selectedOrder: any;
  showBundleCalc: boolean;
  setShowBundleCalc: (b: boolean) => void;
  bundleCount: string;
  setBundleCount: (b: string) => void;
  bundleWeight: string;
  setBundleWeight: (b: string) => void;
  isOverDelivery: boolean | undefined;
  numKilos: number;
  docType: 'remision' | 'factura';
  setDocType: (d: 'remision' | 'factura') => void;
  docFolio: string;
  setDocFolio: (f: string) => void;
  deliveryNotes: string;
  setDeliveryNotes: (n: string) => void;
  saving: boolean;
  handleSubmit: (e: FormEvent) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros de Departamento y Buscador */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ALL', 'TH', 'GT'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              style={{
                background: deptFilter === d ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                color: deptFilter === d ? '#0f172a' : '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {d === 'ALL' ? '🏢 Todas' : d}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar orden o producto..."
          value={searchOc}
          onChange={(e) => setSearchOc(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            boxSizing: 'border-box',
            padding: '9px 14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Listado de OCs Activas */}
      <div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: 10,
          }}
        >
          Órdenes de Compra Activas ({filteredOrders.length})
        </div>

        {filteredOrders.length === 0 && (
          <div style={{ ...glass, padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div>No hay órdenes pendientes con este filtro.</div>
          </div>
        )}

        {filteredOrders.map((o) => {
          const sel = orderId === o.orderId;
          const pct = Math.min(100, Math.round(((o.totalKilos - o.pendingKilos) / Math.max(o.totalKilos, 1)) * 100));

          return (
            <motion.button
              key={o.orderId}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setOrderId(sel ? '' : o.orderId);
                setKilos('');
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: 12,
                padding: '18px 20px',
                borderRadius: 18,
                background: sel
                  ? 'linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(124,58,237,0.2) 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: sel ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                transition: 'all 0.2s ease',
                boxShadow: sel ? '0 8px 24px rgba(167,139,250,0.2)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: sel ? '#e9d5ff' : '#fff' }}>
                    OC {o.folio}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                    {o.productDescription}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, color: '#fbbf24', fontWeight: 800 }}>
                    {o.pendingKilos.toLocaleString('es-MX')} kg
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                    de {o.totalKilos.toLocaleString('es-MX')} kg pedidos
                  </div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 99,
                    background: pct >= 100 ? '#10b981' : '#a78bfa',
                    width: `${pct}%`,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.65)',
                  marginTop: 6,
                }}
              >
                <span>{pct}% entregado</span>
                <span>{sel ? '✓ Seleccionada' : 'Toca para registrar'}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Formulario Interactivo de Registro de Kilos */}
      {selectedOrder && (
        <motion.form
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          onSubmit={handleSubmit}
          style={{
            ...glass,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            border: '2px solid rgba(167, 139, 250, 0.4)',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, color: '#a78bfa', fontWeight: 800 }}>
                ✅ Reportar Entrega para OC {selectedOrder.folio}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {selectedOrder.productDescription} · Pendientes:{' '}
                <strong style={{ color: '#fbbf24' }}>{selectedOrder.pendingKilos.toLocaleString('es-MX')} kg</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBundleCalc(!showBundleCalc)}
              style={{
                background: showBundleCalc ? 'rgba(167, 139, 250, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                borderRadius: 10,
                padding: '6px 10px',
                color: '#c4b5fd',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🧮</span> Bultos
            </button>
          </div>

          {/* Widget de Calculadora de Bultos / Rollos */}
          {showBundleCalc && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
                🧮 Calculadora de Taller (Bultos / Rollos):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                    Bultos / Rollos:
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 40"
                    value={bundleCount}
                    onChange={(e) => setBundleCount(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                    Peso c/u (kg):
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 25"
                    value={bundleWeight}
                    onChange={(e) => setBundleWeight(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
              {Number(bundleCount) > 0 && Number(bundleWeight) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: '#34d399', fontWeight: 800 }}>
                    Total: {(Number(bundleCount) * Number(bundleWeight)).toFixed(2)} kg
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setKilos(String((Number(bundleCount) * Number(bundleWeight)).toFixed(2)));
                      setShowBundleCalc(false);
                    }}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ✨ Aplicar
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Desglose de Partidas del Pedido */}
          {selectedOrder.items && selectedOrder.items.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📋 Partidas Contratadas ({selectedOrder.items.length} productos):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedOrder.items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity) || 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: 8 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 11.5 }}>
                          #{idx + 1} · {it.code || 'S/C'}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>
                          {it.description || 'Bolsa de Polietileno'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#38bdf8', fontSize: 12.5 }}>{qty.toLocaleString('es-MX')} kg</strong>
                        <button
                          type="button"
                          onClick={() => setKilos(String(qty))}
                          title="Cargar estos kilos en la báscula"
                          style={{
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: '#38bdf8',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cargar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Presets Inteligentes de 1-Clic */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setKilos(String(selectedOrder.pendingKilos))}
              style={{
                background: 'rgba(167, 139, 250, 0.2)',
                border: '1px solid #a78bfa',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ✨ Todo ({selectedOrder.pendingKilos} kg)
            </button>
            <button
              type="button"
              onClick={() => setKilos(String(Math.round(selectedOrder.pendingKilos / 2)))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ½ Mitad ({Math.round(selectedOrder.pendingKilos / 2)} kg)
            </button>
            <button
              type="button"
              onClick={() => setKilos(String((Number(kilos) || 0) + 100))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +100 kg
            </button>
            <button
              type="button"
              onClick={() => setKilos(String((Number(kilos) || 0) + 500))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +500 kg
            </button>
            {kilos && (
              <button
                type="button"
                onClick={() => setKilos('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Input de Kilos */}
          <div>
            <label
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Kilos a Entregar:
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={kilos}
              onChange={(e) => setKilos(e.target.value)}
              placeholder="0.00 kg"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '16px',
                fontSize: 32,
                fontWeight: 900,
                textAlign: 'center',
                background: 'rgba(255,255,255,0.08)',
                border: isOverDelivery
                  ? '2px solid #f59e0b'
                  : '1px solid rgba(255,255,255,0.2)',
                borderRadius: 14,
                color: '#fff',
                outline: 'none',
              }}
              autoFocus
            />
            {isOverDelivery && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 6, fontWeight: 600 }}>
                ⚠️ Cantidad excede lo pedido (+{(numKilos - selectedOrder.pendingKilos).toFixed(2)} kg). Requerirá aprobación de administración.
              </div>
            )}
          </div>

          {/* Tipo de Documento: Remisión vs Factura */}
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Documento con el que entregas:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setDocType('remision')}
                style={{
                  padding: '10px',
                  borderRadius: 10,
                  border: docType === 'remision' ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                  background: docType === 'remision' ? 'rgba(167, 139, 250, 0.25)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                📋 Remisión / Báscula
              </button>
              <button
                type="button"
                onClick={() => setDocType('factura')}
                style={{
                  padding: '10px',
                  borderRadius: 10,
                  border: docType === 'factura' ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                  background: docType === 'factura' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                📄 Factura
              </button>
            </div>
            <input
              type="text"
              value={docFolio}
              onChange={(e) => setDocFolio(e.target.value)}
              placeholder={docType === 'factura' ? 'Folio o Número de Factura (ej. 1420)' : 'Folio de Remisión o Ticket (ej. REM-890)'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Input de Nota / Chofer Opcional */}
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>
              Nota u observaciones / Chofer (Opcional):
            </label>
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Ej. Chofer Toño - Camioneta blanca"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Botón de Confirmación */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving || !kilos || numKilos <= 0}
            style={{
              padding: '18px',
              fontSize: 17,
              fontWeight: 900,
              borderRadius: 16,
              background:
                saving || !kilos || numKilos <= 0
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              border: 'none',
              color: '#fff',
              cursor: saving || !kilos || numKilos <= 0 ? 'default' : 'pointer',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            {saving ? '⏳ Guardando entrega...' : `✅ Confirmar Entrega de ${numKilos > 0 ? numKilos : ''} kg`}
          </motion.button>
        </motion.form>
      )}
    </div>
  );
}
