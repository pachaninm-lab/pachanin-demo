import './public-entry-contact-dock-mount.css';
import type { ReactNode } from 'react';
import { PublicContactDock } from '@/components/platform-v7/PublicContactDock';

/**
 * Isolated Lighthouse probe: retain the server-rendered three-action dock but
 * omit the browser-only assistant/support runtime to measure its LCP impact.
 * This branch is evidence-only and must not be merged as-is.
 */
export default function PublicEntryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span data-public-entry-contact-dock-mounted='true' hidden />
      <PublicContactDock />
      <span data-public-entry-contact-dock-end='true' hidden />
    </>
  );
}
