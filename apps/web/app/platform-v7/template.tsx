import type { ReactNode } from 'react';
import { headers } from 'next/headers';

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

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(value: string | null) {
  const pathname = normalizePath(value);
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export default async function PlatformV7Template({ children }: { children: ReactNode }) {
  const pathname = normalizePath(headers().get('x-pc-pathname'));
  if (isPublicPath(pathname)) return children;

  const { PlatformV7ProtectedTemplateRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedTemplateRuntime');
  return <PlatformV7ProtectedTemplateRuntime>{children}</PlatformV7ProtectedTemplateRuntime>;
}
