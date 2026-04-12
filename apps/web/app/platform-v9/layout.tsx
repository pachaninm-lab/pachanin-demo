import type { Metadata } from 'next';
import { AppShell } from '@/components/v9/layout/AppShell';
import '@/app/v9.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена · v9',
  description: 'Control tower для зернового рынка',
};

export default function PlatformV9Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
