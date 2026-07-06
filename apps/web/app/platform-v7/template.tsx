import type { ReactNode } from 'react';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';
import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7MobileFinalGuard } from '@/components/platform-v7/PlatformV7MobileFinalGuard';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PublicDealPathCtaGuard } from '@/components/platform-v7/PublicDealPathCtaGuard';
import { PublicEntryCleanup } from '@/components/platform-v7/PublicEntryCleanup';
import { PublicHeroWeightPatch } from '@/components/platform-v7/PublicHeroWeightPatch';
import { PublicRegistrationEntryPatch } from '@/components/platform-v7/PublicRegistrationEntryPatch';
import { ViewportStabilityGuard } from '@/components/platform-v7/ViewportStabilityGuard';
import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-stable-shell.css';
import '@/styles/platform-v7-viewport-stability.css';
import '@/styles/platform-v7-adaptive-devices.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-load-hotfix.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7RoleLockFix />
      <PlatformV7InteractionFixes />
      <ViewportStabilityGuard />
      <PublicEntryCleanup />
      <PublicRegistrationEntryPatch />
      <PublicHeroWeightPatch />
      <PublicDealPathCtaGuard />
      {children}
      <PlatformTranslator />
      <ChatSupportWidget />
      <PlatformV7MobileFinalGuard />
    </>
  );
}
