import './public-entry-contact-dock-mount.css';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

function normalizePath(value: string | null): string {
  return (value || '').split('?')[0].replace(/\/+$/u, '') || '/platform-v7';
}

function isCanonicalLanding(pathname: string): boolean {
  return pathname === '/platform-v7' || pathname === '/pc-public-entry/platform-v7';
}

/**
 * The canonical landing already owns its public navigation, Gekta entry and
 * bottom mobile navigation. Do not hydrate legacy contact/support surfaces
 * that are deliberately hidden by the canonical UI: they add client JS/CSS
 * without adding a visible or permitted action.
 *
 * Login/recovery and older rewritten public entry routes retain the legacy
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
