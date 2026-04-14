'use client';

import * as React from 'react';

type ToastType = 'success' | 'warning' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType }

const ToastContext = React.createContext<(msg: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const icons: Record<ToastType, string> = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  const colors: Record<ToastType, string> = { success: '#0A7A5F', warning: '#D97706', error: '#DC2626', info: '#0B6B9A' };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: colors[t.type], color: '#fff',
            padding: '12px 16px', borderRadius: 12, maxWidth: 340,
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            pointerEvents: 'auto',
          }}>
            {icons[t.type]} {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);
