import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../../hooks/useOrders';
import { extractCr, getOrderSummary } from '../../lib/finance';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';

export function MobileBottomBar() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const [showQuickSheet, setShowQuickSheet] = useState(false);

  // Badges en tiempo real para alertar al operador en móviles
  const { pendingCrCount, overdueInvoicesCount, pendingDeliveryOrdersCount } = orders.reduce(
    (acc, o) => {
      if ((o as any).isDeleted || o.isClosedShort) return acc;
      const s = getOrderSummary(o);
      if (s.kilosDelivered < (o.totalKilograms || 0) && s.status !== 'collected') {
        acc.pendingDeliveryOrdersCount++;
      }
      (o.invoices || []).forEach((inv: any) => {
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;
        const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const paid = inv.collection?.paidAmount || 0;
        const isPaid = st === 'paid' || st === 'collected' || (paid >= total && total > 0);
        if (!cr && !isPaid) {
          acc.pendingCrCount++;
        }
        if (st === 'overdue') {
          acc.overdueInvoicesCount++;
        }
      });
      return acc;
    },
    { pendingCrCount: 0, overdueInvoicesCount: 0, pendingDeliveryOrdersCount: 0 }
  );

  const handleNavClick = () => {
    triggerHaptic('light');
    sound.playSwoosh();
  };

  return (
    <>
      {/* Barra de Navegación Fija Estilo App Nativa (Mobile Bottom Bar) */}
      <nav
        className="mobile-bottom-bar no-print"
        aria-label="Navegación Móvil Principal"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 900,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 1. Inicio */}
        <NavLink
          to="/"
          end
          onClick={handleNavClick}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: isActive ? '#f59e0b' : '#94a3b8',
            textDecoration: 'none',
            fontSize: 10.5,
            fontWeight: isActive ? 700 : 500,
            padding: '6px 0',
            transition: 'all 0.15s ease',
          })}
        >
          <span style={{ fontSize: 19 }}>📊</span>
          <span>Inicio</span>
        </NavLink>

        {/* 2. Expedientes */}
        <NavLink
          to="/ordenes"
          onClick={handleNavClick}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: isActive ? '#f59e0b' : '#94a3b8',
            textDecoration: 'none',
            fontSize: 10.5,
            fontWeight: isActive ? 700 : 500,
            padding: '6px 0',
            position: 'relative',
            transition: 'all 0.15s ease',
          })}
        >
          <span style={{ fontSize: 19 }}>📂</span>
          <span>Pedidos</span>
          {pendingDeliveryOrdersCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: '25%',
                background: '#2563eb',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 99,
                lineHeight: 1.2,
              }}
            >
              {pendingDeliveryOrdersCount}
            </span>
          )}
        </NavLink>

        {/* 3. Botón Central Flotante "Fast Action Hub" */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              triggerHaptic('medium');
              sound.playPop();
              setShowQuickSheet((prev) => !prev);
            }}
            aria-label="Menú de Acciones Rápidas"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.5), 0 0 10px rgba(245, 158, 11, 0.3)',
              cursor: 'pointer',
              marginTop: -16,
            }}
          >
            {showQuickSheet ? '✕' : '⚡'}
          </motion.button>
        </div>

        {/* 4. Báscula / OC */}
        <NavLink
          to="/oc"
          onClick={handleNavClick}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: isActive ? '#f59e0b' : '#94a3b8',
            textDecoration: 'none',
            fontSize: 10.5,
            fontWeight: isActive ? 700 : 500,
            padding: '6px 0',
            transition: 'all 0.15s ease',
          })}
        >
          <span style={{ fontSize: 19 }}>🚚</span>
          <span>Báscula</span>
        </NavLink>

        {/* 5. Cobranza */}
        <NavLink
          to="/cobranza"
          onClick={handleNavClick}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: isActive ? '#f59e0b' : '#94a3b8',
            textDecoration: 'none',
            fontSize: 10.5,
            fontWeight: isActive ? 700 : 500,
            padding: '6px 0',
            position: 'relative',
            transition: 'all 0.15s ease',
          })}
        >
          <span style={{ fontSize: 19 }}>🧾</span>
          <span>Cobranza</span>
          {pendingCrCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: '20%',
                background: overdueInvoicesCount > 0 ? '#dc2626' : '#d97706',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 99,
                lineHeight: 1.2,
              }}
            >
              {pendingCrCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Popover Táctil Bottom Sheet de Acciones Rápidas */}
      <AnimatePresence>
        {showQuickSheet && (
          <div
            className="mobile-sheet-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 950,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            {/* Scrim translúcido */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickSheet(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
              }}
            />

            {/* Hoja de Acciones */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              style={{
                position: 'relative',
                background: 'var(--paper-raised, #0f172a)',
                borderTop: '1.5px solid rgba(255, 255, 255, 0.15)',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: '16px 20px calc(80px + env(safe-area-inset-bottom, 16px)) 20px',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Handle */}
              <div
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--line, rgba(255, 255, 255, 0.3))',
                  margin: '0 auto 16px auto',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink, #fff)' }}>
                  ⚡ Acciones Rápidas en 1 Toque
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickSheet(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-soft, #94a3b8)',
                    fontSize: 16,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* SECCIÓN HERO: SUBIDA DIRECTA CON CÁMARA / ARCHIVO */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  📸 Ingesta Inmediata (1 Toque)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
                  {/* Foto de Ticket / Subir PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('medium');
                      window.dispatchEvent(new CustomEvent('open-global-file-upload'));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      border: 'none',
                      borderRadius: 14,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                    }}
                  >
                    <span style={{ fontSize: 26 }}>📷</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#ffffff', display: 'block' }}>Foto o PDF</strong>
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.8)' }}>Cámara / Báscula / OC</span>
                    </div>
                  </button>

                  {/* Ver Archivo de Documentos */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('light');
                      navigate('/archivo-documentos');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: 14,
                      padding: '12px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>🗂️</span>
                    <div>
                      <strong style={{ fontSize: 12, color: '#10b981', display: 'block' }}>Archivo</strong>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)' }}>Originales</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SECCIÓN OPERACIÓN: CICLO 3-WAY MATCHING */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  🏭 Ciclo Operativo (Patio ➔ Cobranza)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {/* 1. Registrar Báscula */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('medium');
                      window.dispatchEvent(new CustomEvent('open-fast-delivery'));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(30, 64, 175, 0.06) 100%)',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      borderRadius: 12,
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 48,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🚚</span>
                    <div>
                      <strong style={{ fontSize: 12, color: '#3b82f6', display: 'block' }}>Báscula</strong>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)' }}>Pesaje chofer</span>
                    </div>
                  </button>

                  {/* 2. Emitir Factura */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('medium');
                      window.dispatchEvent(new CustomEvent('open-fast-invoice'));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(180, 83, 9, 0.06) 100%)',
                      border: '1px solid rgba(217, 119, 6, 0.3)',
                      borderRadius: 12,
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 48,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🧾</span>
                    <div>
                      <strong style={{ fontSize: 12, color: '#f59e0b', display: 'block' }}>Facturar</strong>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)' }}>Kilos a CFDI</span>
                    </div>
                  </button>

                  {/* 3. Capturar Contrarecibo */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('medium');
                      navigate('/cobranza');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 12,
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 48,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>📑</span>
                    <div>
                      <strong style={{ fontSize: 12, color: '#10b981', display: 'block' }}>Capturar CR</strong>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)' }}>Sello Providencia</span>
                    </div>
                  </button>

                  {/* 4. Recibir a Caja */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickSheet(false);
                      triggerHaptic('cash');
                      window.dispatchEvent(new CustomEvent('open-fast-cr-collection'));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(15, 118, 110, 0.06) 100%)',
                      border: '1px solid rgba(13, 148, 136, 0.3)',
                      borderRadius: 12,
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 48,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>💵</span>
                    <div>
                      <strong style={{ fontSize: 12, color: '#14b8a6', display: 'block' }}>Cobro a Caja</strong>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)' }}>Tesorería</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SECCIÓN HERRAMIENTAS DIRECTAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {/* Centinela */}
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickSheet(false);
                    triggerHaptic('medium');
                    navigate('/audit');
                  }}
                  style={{
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--line, rgba(255, 255, 255, 0.12))',
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 18 }}>🛡️</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink, #fff)' }}>Centinela ERP</span>
                </button>

                {/* Búsqueda */}
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickSheet(false);
                    triggerHaptic('light');
                    window.dispatchEvent(new CustomEvent('open-command-menu'));
                  }}
                  style={{
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--line, rgba(255, 255, 255, 0.12))',
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink, #fff)' }}>Búsqueda</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
