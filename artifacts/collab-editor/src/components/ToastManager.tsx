import { useEffect, useState } from 'react';
import { useStore } from '../store';

interface ToastItem {
  id: string;
  type: 'join' | 'leave';
  userId: string;
  userName: string;
  color: string;
  createdAt: number;
  exiting: boolean;
}

export function ToastManager() {
  const toasts = useStore(s => s.toasts);
  const removeToast = useStore(s => s.removeToast);
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    setItems(prev => {
      const prevIds = new Set(prev.map(t => t.id));
      const added = toasts
        .filter(t => !prevIds.has(t.id))
        .map(t => ({ ...t, exiting: false }));
      return [...prev.filter(p => toasts.some(t => t.id === p.id)), ...added];
    });
  }, [toasts]);

  useEffect(() => {
    if (items.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    items.forEach(item => {
      if (item.exiting) return;
      const age = Date.now() - item.createdAt;
      const remaining = Math.max(0, 3000 - age);

      const exitTimer = setTimeout(() => {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, exiting: true } : p));
        setTimeout(() => {
          removeToast(item.id);
          setItems(prev => prev.filter(p => p.id !== item.id));
        }, 280);
      }, remaining);

      timers.push(exitTimer);
    });

    return () => timers.forEach(clearTimeout);
  }, [items.map(i => i.id + i.exiting).join('|')]);

  const visible = items.slice(-3);

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      {visible.map(toast => (
        <div
          key={toast.id}
          className={toast.exiting ? 'toast-exit' : 'toast-enter'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#1c2128',
            border: '1px solid #30363d',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            minWidth: '220px',
            maxWidth: '300px',
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              flexShrink: 0,
              background: toast.type === 'join' ? toast.color : '#30363d',
              color: toast.type === 'join' ? '#000' : '#7d8590',
            }}
          >
            {toast.userName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 600, lineHeight: 1.3 }}>
              {toast.userName}
            </span>
            <span style={{ fontSize: '11px', color: '#7d8590', lineHeight: 1.3 }}>
              {toast.type === 'join' ? 'joined the session' : 'left the session'}
            </span>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: toast.type === 'join' ? '#3fb950' : '#484f58',
              flexShrink: 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}
