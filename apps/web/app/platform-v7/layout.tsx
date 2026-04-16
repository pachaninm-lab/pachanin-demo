import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShellV3 as AppShellV2 } from '@/components/v7r/AppShellV3';
import { ToastProvider } from '@/components/v7r/Toast';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения сделки',
};

export default function PlatformV7Layout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShellV2>{children}</AppShellV2>
    </ToastProvider>
  );
}
