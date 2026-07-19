import type { ReactNode } from 'react';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PublicContactDock } from '@/components/platform-v7/PublicContactDock';

/**
 * The landing, login and recovery URLs are rewritten into this physically
 * isolated tree. Render the contact dock as its own client boundary so the
 * three-action surface is present in the initial HTML, while the assistant and
 * support panels may continue loading through the hydration-safe runtime.
 */
export default function PublicEntryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span data-public-entry-contact-dock-mounted='true' hidden />
      <PublicContactDock />
      <HydrationSafeChatSupport />
    </>
  );
}
