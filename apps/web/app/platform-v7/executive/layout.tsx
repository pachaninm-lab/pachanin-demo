import type { ReactNode } from 'react';
import { RbacGuard } from '@/components/platform-v7/RbacGuard';

export default function ExecutiveLayout({ children }: { children: ReactNode }) {
  return <RbacGuard surface="executive_workspace">{children}</RbacGuard>;
}
