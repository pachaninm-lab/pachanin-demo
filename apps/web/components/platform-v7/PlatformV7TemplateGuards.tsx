'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChatSupportWidget } from '@/components/platform-v7/ChatSupportWidget';
import { LoginHeaderLogoGuard } from '@/components/platform-v7/LoginHeaderLogoGuard';
import { LoginMobileStabilityStyle } from '@/components/platform-v7/LoginMobileStabilityStyle';
import { MobileLogoutSoftExit } from '@/components/platform-v7/MobileLogoutSoftExit';
import { PlatformV7BlankScreenGuard } from '@/components/platform-v7/PlatformV7BlankScreenGuard';
import { PlatformV7InteractionFixes } from '@/components/platform-v7/PlatformV7InteractionFixes';
import { PlatformV7MobileFinalGuard } from '@/components/platform-v7/PlatformV7MobileFinalGuard';
import { PlatformV7RoleLockFix } from '@/components/platform-v7/PlatformV7RoleLockFix';
import { PlatformV7UniversalAdaptiveStyle } from '@/components/platform-v7/PlatformV7UniversalAdaptiveStyle';
import { PlatformV7ViewportRuntimeGuard } from '@/components/platform-v7/PlatformV7ViewportRuntimeGuard';
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
  '/platform-v7/forgot-password',
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

const OPEN_FORM_PLACEHOLDER_SELECTORS = [
  '#pc-open-login',
  '#pc-open-code',
  '#pc-open-company',
  '#pc-recovery-contact',
  '#pc-recovery-comment',
] as const;

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

function isAuthPath(pathname: string | null): boolean {
  const path = normalizePath(pathname);
  return path === '/platform-v7/login' || path === '/platform-v7/forgot-password';
}

function PublicOpenPlaceholderCleanup({ pathname }: { pathname: string | null }) {
  useEffect(() => {
    if (normalizePath(pathname) !== '/platform-v7/open') return;

    function cleanup() {
      for (const selector of OPEN_FORM_PLACEHOLDER_SELECTORS) {
        document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.removeAttribute('placeholder');
      }
    }

    cleanup();
    const raf = window.requestAnimationFrame(cleanup);
    const timers = [80, 240, 600].map((delay) => window.setTimeout(cleanup, delay));
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}

export function PlatformV7TemplateGuards({ position }: { position: GuardPosition }) {
  const pathname = usePathname();
  const publicPath = isPublicPath(pathname);
  const landingPath = isLandingPath(pathname);
  const authPath = isAuthPath(pathname);

  if (publicPath) {
    if (landingPath) {
      return position === 'before' ? <><PlatformV7UniversalAdaptiveStyle /><PlatformV7ViewportRuntimeGuard /><PublicOpenPlaceholderCleanup pathname={pathname} /><PublicHeroWeightPatch /><PlatformV7BlankScreenGuard /></> : <ChatSupportWidget />;
    }

    if (position === 'before') {
      return (
        <>
          <PlatformV7UniversalAdaptiveStyle />
          <PlatformV7ViewportRuntimeGuard />
          {authPath ? <LoginMobileStabilityStyle /> : null}
          <PlatformV7BlankScreenGuard />
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
        <PlatformV7UniversalAdaptiveStyle />
        <PlatformV7ViewportRuntimeGuard />
        <PlatformV7BlankScreenGuard />
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
