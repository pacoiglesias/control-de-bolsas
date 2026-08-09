import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export function OnlineUsers() {
  const { onlineUsers } = usePresence();
  const { user } = useAuth();

  const others = onlineUsers.filter(u => u.uid !== user?.uid);

  if (others.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
      <AnimatePresence>
        {others.map((u) => {
          const initial = u.email ? u.email.substring(0, 1).toUpperCase() : '?';
          // Check if they are in the same route
          const isSameRoute = window.location.pathname === u.currentPath;

          return (
            <motion.div
              key={u.uid}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              title={`${u.email} (En ${u.currentPath})`}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isSameRoute ? 'var(--info)' : 'var(--accent)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
                boxShadow: isSameRoute ? '0 0 0 2px var(--bg), 0 0 0 4px var(--info)' : 'none',
                position: 'relative'
              }}
            >
              {initial}
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--ok)', border: '2px solid var(--bg)'
              }} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
