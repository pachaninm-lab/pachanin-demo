import type { ReactNode } from 'react';
import '@/app/v9.css';
import { AppShell } from '@/components/v7r/AppShell';
import { ToastProvider } from '@/components/v7r/Toast';

export default function PlatformV7RLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
