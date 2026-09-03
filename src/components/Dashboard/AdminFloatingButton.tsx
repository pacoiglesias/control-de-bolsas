import { motion } from 'framer-motion';

interface AdminFloatingButtonProps {
  onClick: () => void;
}

/**
 * Botón flotante de acceso rápido al panel de administración.
 * Solo visible para usuarios con role === 'admin'.
 * Posicionado encima del FloatingQuickHub (bottom: 88px).
 */
export function AdminFloatingButton({ onClick }: AdminFloatingButtonProps) {
  return (
    <motion.button
      type="button"
      title="Edición Rápida del Sistema"
      className="admin-fab"
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      ⚡
    </motion.button>
  );
}
