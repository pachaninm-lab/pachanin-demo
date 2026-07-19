import type { ReactNode } from 'react';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';

/**
 * The landing, login and recovery URLs are rewritten into this physically
 * isolated tree. Keep the unified contact dock at the tree boundary so all
 * three entry surfaces get exactly one hydration-safe mount.
 */
export default function PublicEntryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <HydrationSafeChatSupport />
    </>
  );
}
