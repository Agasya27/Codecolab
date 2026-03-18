import { useStore } from '../store';

export function useToast() {
  const toasts = useStore((s) => s.toasts);
  const addToast = useStore((s) => s.addToast);
  const removeToast = useStore((s) => s.removeToast);
  return { toasts, addToast, removeToast };
}
