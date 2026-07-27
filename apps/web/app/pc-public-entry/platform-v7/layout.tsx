import './public-entry-contact-dock-mount.css';
import type { ReactNode } from 'react';
import { PublicContactDock } from '@/components/platform-v7/PublicContactDock';

/**
 * Evidence-only Lighthouse probe from the exact PR #3249 head.
 * Keep the visible three-action dock in initial HTML, but do not mount the
 * deferred assistant/support runtime during the initial public entry render.
 * This isolates its hydration and module-evaluation cost without changing
 * the landing content, contact actions, backend, authority, or production code.
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
