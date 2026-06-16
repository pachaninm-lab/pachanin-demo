'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(normalize(pathname));
}

export function PlatformV7SingleEntryGuard() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (!pathname) return;
    const path = normalize(pathname);
    if (!path.startsWith('/platform-v7')) return;
    if (isPublicPath(path)) return;
  }, [pathname, router]);

  return null;
}
