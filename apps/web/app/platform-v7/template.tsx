import type { ReactNode } from 'react';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PublicEntryCleanup } from '@/components/platform-v7/PublicEntryCleanup';
import { PublicHeroCopyNormalizer } from '@/components/platform-v7/PublicHeroCopyNormalizer';
import { PublicHeroWeightPatch } from '@/components/platform-v7/PublicHeroWeightPatch';
import { PublicRegistrationEntryPatch } from '@/components/platform-v7/PublicRegistrationEntryPatch';
import { ViewportStabilityGuard } from '@/components/platform-v7/ViewportStabilityGuard';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-stable-shell.css';
import '@/styles/platform-v7-viewport-stability.css';
// Держать последним: финальный сдерживающий слой мобильной вёрстки.
import '@/styles/platform-v7-mobile-containment-final.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7RoleLockFix />
      <PlatformV7InteractionFixes />
      <ViewportStabilityGuard />
      <PublicEntryCleanup />
      <PublicRegistrationEntryPatch />
      <PublicHeroCopyNormalizer />
      <PublicHeroWeightPatch />
      {children}
    </>
  );
}
