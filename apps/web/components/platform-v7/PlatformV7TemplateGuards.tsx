'use client';

import { usePathname } from 'next/navigation';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';
import { LoginHeaderLogoGuard } from '@/components/platform-v7/LoginHeaderLogoGuard';
import { MobileLogoutSoftExit } from '@/components/platform-v7/MobileLogoutSoftExit';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7MobileFinalGuard } from '@/components/platform-v7/PlatformV7MobileFinalGuard';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PublicBrandLogoFinal } from '@/components/platform-v7/PublicBrandLogoFinal';
import { PublicEntryCleanup } from '@/components/platform-v7/PublicEntryCleanup';
import { PublicHeaderFinalLock } from '@/components/platform-v7/PublicHeaderFinalLock';
import { PublicHeroWeightPatch } from '@/components/platform-v7/PublicHeroWeightPatch';
import { PublicRegistrationEntryPatch } from '@/components/platform-v7/PublicRegistrationEntryPatch';
import { ViewportStabilityGuard } from '@/components/platform-v7/ViewportStabilityGuard';

const PUBLIC_EXACT_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

type GuardPosition = 'before' | 'after';

function normalizePath(pathname: string | null): string {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string | null): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIX_PATHS.some((prefix) => path.startsWith(prefix));
}

function isLandingPath(pathname: string | null): boolean {
  const path = normalizePath(pathname);
  return path === '/platform-v7' || path === '/platform-v7/open';
}

export function PlatformV7TemplateGuards({ position }: { position: GuardPosition }) {
  const pathname = usePathname();
  const publicPath = isPublicPath(pathname);
  const landingPath = isLandingPath(pathname);

  if (publicPath) {
    if (landingPath) {
      return position === 'before' ? <PublicHeroWeightPatch /> : <ChatSupportWidget />;
    }

    if (position === 'before') {
      return (
        <>
          <PublicEntryCleanup />
          <PublicRegistrationEntryPatch />
          <PublicHeroWeightPatch />
        </>
      );
    }

    return (
      <>
        <PublicHeaderFinalLock />
        <PublicBrandLogoFinal />
        <LoginHeaderLogoGuard />
        <ChatSupportWidget />
      </>
    );
  }

  if (position === 'before') {
    return (
      <>
        <MobileLogoutSoftExit />
        <PlatformV7RoleLockFix />
        <PlatformV7InteractionFixes />
        <ViewportStabilityGuard />
      </>
    );
  }

  return (
    <>
      <ChatSupportWidget />
      <PlatformV7MobileFinalGuard />
    </>
  );
}
