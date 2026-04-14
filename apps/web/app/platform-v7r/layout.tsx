import type { ReactNode } from 'react';
import '@/app/v9.css';
import { AppShell } from '@/components/v7r/AppShell';

export default function PlatformV7RLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
