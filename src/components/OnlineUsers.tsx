import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export function OnlineUsers() {
  const { onlineUsers } = usePresence();
  const { user } = useAuth();

  const others = onlineUsers.filter((u) => u.uid !== user?.uid);

  if (others.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
      <AnimatePresence>
        {others.map((u) => {
          const initial = u.email ? u.email.substring(0, 2).toUpperCase() : '??';
          const isSameRoute = window.location.pathname === u.currentPath;

          const routeName =
            u.currentPath === '/'
              ? 'Dashboard'
              : u.currentPath === '/ordenes'
              ? 'Órdenes'
              : u.currentPath === '/cobranza'
              ? 'Cobranza'
              : u.currentPath === '/caja-chica'
              ? 'Caja Chica'
              : u.currentPath;

          return (
            <motion.div
              key={u.uid}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.15, zIndex: 20 }}
              title={`${u.email} · Viendo: ${routeName}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: isSameRoute
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 11,
                boxShadow: isSameRoute
                  ? '0 0 0 2px var(--paper-raised), 0 0 0 4px #3b82f6'
                  : '0 0 0 2px var(--paper-raised)',
                position: 'relative',
                cursor: 'default',
              }}
            >
              {initial}
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid var(--paper-raised)',
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
