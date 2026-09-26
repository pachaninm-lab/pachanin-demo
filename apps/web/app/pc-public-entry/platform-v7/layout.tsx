import './public-entry-contact-dock-mount.css';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

function normalizePath(value: string | null): string {
  return (value || '').split('?')[0].replace(/\/+$/u, '') || '/platform-v7';
}

function isCanonicalLanding(pathname: string): boolean {
  return pathname === '/platform-v7'
    || pathname === '/pc-public-entry/platform-v7'
    || pathname === '/platform-v7/login'
    || pathname === '/pc-public-entry/platform-v7/login';
}

/**
 * The canonical landing and canonical login own the same public navigation,
 * Gekta entry and bottom mobile navigation. Do not hydrate legacy support
 * presentation on those surfaces: the existing PublicPlatformAssistant remains
 * the single chat authority while the Gekta-only dock is the visible entry.
 *
 * Recovery and older rewritten public entry routes retain the legacy full
 * support mount unchanged.
 */
export default async function PublicEntryLayout({ children }: { children: ReactNode }) {
  const pathname = normalizePath((await headers()).get('x-pc-pathname'));
  const canonicalLanding = isCanonicalLanding(pathname);

  const [{ HydrationSafeChatSupport }, { PublicContactDock }] = await Promise.all([
    import('@/components/platform-v7/HydrationSafeChatSupport'),
    import('@/components/platform-v7/PublicContactDock'),
  ]);

  return (
    <>
      {children}
      <span data-public-entry-contact-dock-mounted='true' hidden />
      <PublicContactDock assistantContext='public' publicMode={canonicalLanding ? 'gekta' : 'full'} />
      <span data-public-entry-contact-dock-end='true' hidden />
      <HydrationSafeChatSupport renderDock={false} legacyPublicPolish={!canonicalLanding} />
    </>
  );
}
