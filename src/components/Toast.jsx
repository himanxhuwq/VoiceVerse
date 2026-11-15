import { AnimatePresence, motion } from 'motion/react';
import { useToast } from '../state/toast';

export default function Toast() {
  const current = useToast();
  return (
    <div role="status" aria-live="polite">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            className="toast"
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          >
            {current.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
