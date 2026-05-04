'use client';

import { usePathname } from 'next/navigation';
import { SystemRouteSummary } from './SystemRouteSummary';

type SystemSurface =
  | 'operator'
  | 'operatorQueues'
  | 'controlTower'
  | 'lab'
  | 'compliance'
  | 'demo'
  | 'notifications'
  | 'profile'
  | 'auth'
  | 'register'
  | 'deployCheck';

export function getPlatformV7SystemSurface(pathname: string | null): SystemSurface | undefined {
  if (!pathname) return undefined;
  if (pathname === '/platform-v7/operator') return 'operator';
  if (pathname === '/platform-v7/operator-cockpit/queues') return 'operatorQueues';
  if (pathname === '/platform-v7/control-tower') return 'controlTower';
  if (pathname === '/platform-v7/lab') return 'lab';
  if (pathname === '/platform-v7/compliance') return 'compliance';
  if (pathname === '/platform-v7/demo') return 'demo';
  if (pathname === '/platform-v7/notifications') return 'notifications';
  if (pathname === '/platform-v7/profile') return 'profile';
  if (pathname === '/platform-v7/auth' || pathname === '/platform-v7/login') return 'auth';
  if (pathname === '/platform-v7/register') return 'register';
  if (pathname === '/platform-v7/deploy-check') return 'deployCheck';
  return undefined;
}

export function SystemRouteSummaryGate() {
  const pathname = usePathname();
  const surface = getPlatformV7SystemSurface(pathname);

  if (!surface) return null;

  return <SystemRouteSummary surface={surface} />;
}
