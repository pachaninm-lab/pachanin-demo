'use client';

import { createContext, useContext } from 'react';

type ToastTone = 'success' | 'error' | 'info';

type ToastApi = {
  show: (tone: ToastTone, message: string) => void;
};

const ToastContext = createContext<ToastApi>({
  show: (_tone, _message) => {}
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <ToastContext.Provider value={{ show: (_tone, _message) => {} }}>{children}</ToastContext.Provider>;
}
