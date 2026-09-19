'use client';

import { usePathname } from 'next/navigation';
import { AuditSurfaceSummary } from './AuditSurfaceSummary';

type AuditSurface = 'bank' | 'documents' | 'disputes';

export function getPlatformV7AuditSurface(pathname: string | null): AuditSurface | undefined {
  if (!pathname) return undefined;
  if (pathname === '/platform-v7/bank' || pathname.startsWith('/platform-v7/bank/')) return 'bank';
  if (pathname === '/platform-v7/documents') return 'documents';
  if (pathname === '/platform-v7/disputes' || pathname.startsWith('/platform-v7/disputes/')) return 'disputes';
  return undefined;
}

export function AuditSurfaceSummaryGate() {
  const pathname = usePathname();
  const surface = getPlatformV7AuditSurface(pathname);

  if (!surface) return null;

  return <AuditSurfaceSummary surface={surface} />;
}
