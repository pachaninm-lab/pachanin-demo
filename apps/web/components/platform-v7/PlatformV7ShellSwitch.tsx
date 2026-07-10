'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const PlatformV7ProtectedShell = dynamic(
  () => import('@/components/platform-v7/PlatformV7ProtectedShell').then((module) => module.PlatformV7ProtectedShell)
);

const PUBLIC_EXACT_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIX_PATHS.some((prefix) => path.startsWith(prefix));
}

export function PlatformV7ShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/platform-v7';
  if (isPublicPath(pathname)) return <>{children}</>;
  return <PlatformV7ProtectedShell pathname={pathname}>{children}</PlatformV7ProtectedShell>;
}
