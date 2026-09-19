'use client';

import { type ReactNode } from 'react';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { canSee, type DataAtom } from '@/lib/platform-v7/role-lens';

interface RoleLensGateProps {
  atom: DataAtom;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the current role can see the given data atom.
 * Use fallback to show a redacted placeholder when access is denied.
 */
export function RoleLensGate({ atom, children, fallback = null }: RoleLensGateProps) {
  const role = usePlatformV7RStore((s) => s.role);
  return canSee(role, atom) ? <>{children}</> : <>{fallback}</>;
}
