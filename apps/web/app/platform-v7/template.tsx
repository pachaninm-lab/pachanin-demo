import type { ReactNode } from 'react';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PublicEntryCleanup } from '@/components/platform-v7/PublicEntryCleanup';
import { PublicRegistrationEntryPatch } from '@/components/platform-v7/PublicRegistrationEntryPatch';
import { PublicTourControlPatch } from '@/components/platform-v7/PublicTourControlPatch';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-stable-shell.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7RoleLockFix />
      <PlatformV7InteractionFixes />
      <PublicEntryCleanup />
      <PublicRegistrationEntryPatch />
      <PublicTourControlPatch />
      {children}
    </>
  );
}
