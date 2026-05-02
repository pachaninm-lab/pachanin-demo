'use client';

import { usePathname } from 'next/navigation';
import { RoleExecutionSummary, type PlatformV7ExecutionRole } from './RoleExecutionSummary';

const SUMMARY_BY_ROUTE: Record<string, PlatformV7ExecutionRole> = {
  '/platform-v7/buyer': 'buyer',
  '/platform-v7/logistics': 'logistics',
  '/platform-v7/control-tower': 'operator',
  '/platform-v7/investor': 'investor',
  '/platform-v7/executive': 'executive',
};

export function RoleExecutionSummaryGate() {
  const pathname = usePathname();
  const role = pathname ? SUMMARY_BY_ROUTE[pathname] : undefined;

  if (!role) return null;

  return <RoleExecutionSummary role={role} />;
}
