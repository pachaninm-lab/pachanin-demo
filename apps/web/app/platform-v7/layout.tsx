import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShellV2 } from '@/components/v7r/AppShellV2';
import { ToastProvider } from '@/components/v7r/Toast';
import '@/app/v9.css';

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
