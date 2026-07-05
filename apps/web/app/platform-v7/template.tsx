import type { ReactNode } from 'react';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';
import { LoginHeaderLogoGuard } from '@/components/platform-v7/LoginHeaderLogoGuard';
import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7MobileFinalGuard } from '@/components/platform-v7/PlatformV7MobileFinalGuard';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PublicBrandLogoFinal } from '@/components/platform-v7/PublicBrandLogoFinal';
import { PublicEntryCleanup } from '@/components/platform-v7/PublicEntryCleanup';
import { PublicHeaderFinalLock } from '@/components/platform-v7/PublicHeaderFinalLock';
import { PublicHeroWeightPatch } from '@/components/platform-v7/PublicHeroWeightPatch';
import { PublicMobileLandingFix } from '@/components/platform-v7/PublicMobileLandingFix';
import { PublicRegistrationEntryPatch } from '@/components/platform-v7/PublicRegistrationEntryPatch';
import { ViewportStabilityGuard } from '@/components/platform-v7/ViewportStabilityGuard';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-stable-shell.css';
import '@/styles/platform-v7-viewport-stability.css';
import '@/styles/platform-v7-adaptive-devices.css';
import '@/styles/platform-v7-i18n-cjk.css';

export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformV7RoleLockFix />
      <PlatformV7InteractionFixes />
      <ViewportStabilityGuard />
      <PublicEntryCleanup />
      <PublicRegistrationEntryPatch />
      <PublicHeroWeightPatch />
      {children}
      <PlatformTranslator />
      <PublicMobileLandingFix />
      <PublicHeaderFinalLock />
      <PublicBrandLogoFinal />
      <LoginHeaderLogoGuard />
      <ChatSupportWidget />
      <PlatformV7MobileFinalGuard />
    </>
  );
}
