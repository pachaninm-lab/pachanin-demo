import './public-entry-contact-dock-mount.css';
import type { ReactNode } from 'react';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PublicContactDock } from '@/components/platform-v7/PublicContactDock';

/**
 * The landing, login and recovery URLs are rewritten into this physically
 * isolated tree. Render the visible three-action dock in initial HTML; the
 * hydration-safe runtime supplies only the deferred assistant and support
 * panels and is explicitly forbidden from mounting a second dock.
 */
export default function PublicEntryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span data-public-entry-contact-dock-mounted='true' hidden />
      <PublicContactDock />
      <span data-public-entry-contact-dock-end='true' hidden />
      <HydrationSafeChatSupport renderDock={false} />
    </>
  );
}
