import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { useEffect, useMemo } from 'react';

export function Toast() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);
  const visibleToasts = useMemo(() => toasts.slice(-4), [toasts]);

  useEffect(() => {
    if (visibleToasts.length === 0) return;

    const timers = visibleToasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), 2800),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [removeToast, visibleToasts]);

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {visibleToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, y: 8 }}
            transition={{ duration: 0.18 }}
            className="toast-card px-3 py-2 rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl min-w-[220px]"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: toast.color }}
              >
                {toast.userName.slice(0, 2).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[#e6edf3]">{toast.userName}</p>
                <p className="text-xs font-medium text-[#7d8590]">
                  {toast.type === 'join' ? 'joined the session' : 'left the session'}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
