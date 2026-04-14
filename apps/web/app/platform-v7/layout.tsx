import type { Metadata } from 'next';
import { AppShell } from '@/components/v7r/AppShell';
import '@/app/v9.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения сделки',
};

export default function PlatformV7Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
