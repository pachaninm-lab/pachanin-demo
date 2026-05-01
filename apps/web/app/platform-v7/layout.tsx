import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения сделки и операционного контроля',
};

export default function PlatformV7Layout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
