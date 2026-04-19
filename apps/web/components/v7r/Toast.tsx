'use client';

import * as React from 'react';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastAction { label: string; onClick: () => void }

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  actions?: ToastAction[];
}

interface ToastOptions {
  type?: ToastType;
  actions?: ToastAction[];
  duration?: number;
}

type ShowToastFn = (message: string, typeOrOptions?: ToastType | ToastOptions) => void;

const ToastContext = React.createContext<ShowToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const showToast = React.useCallback<ShowToastFn>((message, typeOrOptions) => {
    const id = Date.now();
    let type: ToastType = 'success';
    let actions: ToastAction[] | undefined;
    let duration = 6000;

    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions;
    } else if (typeOrOptions) {
      type = typeOrOptions.type ?? 'success';
      actions = typeOrOptions.actions;
      duration = typeOrOptions.duration ?? 6000;
    }

    setToasts(t => [...t, { id, message, type, actions }]);
    const timer = setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const icons: Record<ToastType, string> = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: '#0A7A5F', border: '#0A7A5F', text: '#fff' },
    warning: { bg: '#FFF7ED', border: '#FED7AA', text: '#92400E' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, width: 'calc(100vw - 32px)' }}>
        {toasts.map(t => {
          const c = colors[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                background: c.bg,
                color: c.text,
                padding: '12px 14px',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                border: `1px solid ${c.border}`,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <span>{icons[t.type]} {t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Закрыть"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}
                >
                  ×
                </button>
              </div>
              {t.actions?.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {t.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => { action.onClick(); dismiss(t.id); }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: i === 0 ? c.text : 'transparent',
                        color: i === 0 ? c.bg : c.text,
                        border: `1px solid ${i === 0 ? c.text : c.border}`,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);
