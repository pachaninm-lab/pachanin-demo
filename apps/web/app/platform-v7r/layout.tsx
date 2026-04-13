import { AppShell } from '@/components/v7r/AppShell';
import '@/app/v9.css';

export default function PlatformV7RLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
