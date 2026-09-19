'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

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

/**
 * Legacy compatibility boundary for old public-layout imports.
 *
 * Protected business routes must be mounted only by the server layout after a
 * signed cabinet/access JWT has been verified. This client component therefore
 * renders public children only and fails closed for every protected pathname;
 * it can never instantiate PlatformV7ProtectedShell or assign a role.
 */
export function PlatformV7ShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/platform-v7';
  return isPublicPath(pathname) ? <>{children}</> : null;
}
