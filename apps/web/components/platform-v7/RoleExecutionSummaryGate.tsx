'use client';

import { usePathname } from 'next/navigation';
import { RoleExecutionSummary, type PlatformV7ExecutionRole } from './RoleExecutionSummary';

export const PLATFORM_V7_SUMMARY_BY_ROUTE: Record<string, PlatformV7ExecutionRole> = {
  '/platform-v7/seller': 'seller',
  '/platform-v7/buyer': 'buyer',
  '/platform-v7/logistics': 'logistics',
  '/platform-v7/logistics/inbox': 'logistics',
  '/platform-v7/driver': 'driver',
  '/platform-v7/driver/field': 'driver',
  '/platform-v7/elevator': 'elevator',
  '/platform-v7/control-tower': 'operator',
  '/platform-v7/support/operator': 'operator',
  '/platform-v7/investor': 'investor',
};

export function RoleExecutionSummaryGate() {
  const pathname = usePathname();
  const role = pathname ? PLATFORM_V7_SUMMARY_BY_ROUTE[pathname] : undefined;

  if (!role) return null;

  return <RoleExecutionSummary role={role} />;
}
