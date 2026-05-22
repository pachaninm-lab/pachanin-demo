import type { ReactNode } from 'react';
import { RbacGuard } from '@/components/platform-v7/RbacGuard';

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <RbacGuard surface="driver_field">{children}</RbacGuard>;
}
