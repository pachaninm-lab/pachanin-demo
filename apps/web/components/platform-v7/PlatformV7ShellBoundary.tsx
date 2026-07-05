'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { MobileHeaderActionRail } from '@/components/platform-v7/MobileHeaderActionRail';
import { NotepadHeaderWidget } from '@/components/platform-v7/NotepadHeaderWidget';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { PlatformFooter } from '@/components/platform-v7/PlatformFooter';
import { OnboardingTour } from '@/components/platform-v7/OnboardingTour';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PUBLIC_EXACT_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/docs']);
const PUBLIC_PREFIXES = ['/platform-v7/demo/', '/platform-v7/contact/', '/platform-v7/request/', '/platform-v7/docs/'];

const shellRestoreCss = `
  html body .pc-shell-root-v4 style{display:none!important}
  @media (max-width:767px){
    html body .pc-shell-root-v4 .pc-v4-header{display:block!important;position:fixed!important;inset:0 0 auto 0!important;z-index:3300!important;min-block-size:calc(env(safe-area-inset-top) + 62px)!important;visibility:visible!important;opacity:1!important;transform:none!important;overflow:visible!important}
    html body .pc-shell-root-v4 .pc-v4-header-inner{display:grid!important;align-items:center!important;min-block-size:calc(env(safe-area-inset-top) + 58px)!important;padding:calc(env(safe-area-inset-top) + 7px) 10px 7px!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-top{display:grid!important;grid-template-columns:40px 42px minmax(0,1fr)!important;gap:7px!important;align-items:center!important;inline-size:100%!important;max-inline-size:100%!important;min-block-size:42px!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-top>button[aria-label='Открыть меню']{grid-column:1!important;display:inline-flex!important;inline-size:40px!important;min-inline-size:40px!important;max-inline-size:40px!important;block-size:40px!important;min-block-size:40px!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-brand{grid-column:2!important;display:inline-flex!important;inline-size:42px!important;min-inline-size:42px!important;max-inline-size:42px!important;block-size:40px!important;align-items:center!important;justify-content:center!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]{display:inline-flex!important;inline-size:38px!important;min-inline-size:38px!important;max-inline-size:38px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important;flex:0 0 38px!important;visibility:visible!important;opacity:1!important;overflow:visible!important}
    html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden] img{display:block!important;inline-size:100%!important;block-size:100%!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-brand>span:not([aria-hidden]){display:none!important}
    html body .pc-shell-root-v4 .pc-v4-actions{grid-column:3!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;inline-size:100%!important;max-inline-size:100%!important;min-inline-size:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-stage,
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-theme-toggle,
    html body .pc-shell-root-v4 .pc-v4-actions button[aria-label='Открыть уведомления'],
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-notice-wrap,
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-logout-btn,
    html body .pc-shell-root-v4 .pc-v4-actions .p7-note-widget,
    html body .pc-shell-root-v4 .pc-v4-actions .p7-mobile-tools-trigger,
    html body .pc-shell-root-v4 .pc-v4-actions .p7-role-support{display:none!important}
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search{display:inline-flex!important;align-items:center!important;justify-content:center!important;inline-size:38px!important;min-inline-size:38px!important;max-inline-size:38px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important;padding:0!important;border-radius:13px!important;flex:0 0 38px!important}
    html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search strong,html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search span{display:none!important}
    html body .pc-shell-root-v4 .pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 76px)!important;padding-bottom:calc(env(safe-area-inset-bottom) + 142px)!important}
    html body .pc-shell-root-v4 .pc-v7-role-dock{display:block!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:700!important;visibility:visible!important;opacity:1!important;transform:none!important;pointer-events:auto!important}
    html body .pc-shell-root-v4 .pc-v7-role-dock button.pc-v7-role-dock-more{display:grid!important;visibility:visible!important;opacity:1!important}
    html body .pc-shell-root-v4 .pc-v7-assistant-widget,html body .pc-shell-root-v4 .p7-support-chat-button{right:12px!important;bottom:calc(env(safe-area-inset-bottom) + 108px)!important;inline-size:46px!important;block-size:46px!important;min-height:46px!important;max-width:46px!important;padding:0!important;border-radius:18px!important;justify-content:center!important}
    html body .pc-shell-root-v4 .pc-v7-assistant-widget span,html body .pc-shell-root-v4 .p7-support-chat-button span{display:none!important}
  }
`;

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPlatformPath(pathname: string | null) {
  const path = normalize(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function PlatformV7PrivateShell({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  return (
    <AppShellV4 initialRole={initialRole}>
      <>
        <ScopedShellGuard />
        <PlatformV7SingleEntryGuard />
        <PlatformV7ShellUxController />
        <RbacCabinetGuard />
        <ShellCopyNormalizer />
        <CalculatorHeaderWidget />
        <NotepadHeaderWidget />
        <SupportHeaderIcon />
        <MobileHeaderActionRail />
        <RoleAssistantWidget />
        {children}
        <PlatformFooter />
        <OnboardingTour />
        <style dangerouslySetInnerHTML={{ __html: shellRestoreCss }} />
      </>
    </AppShellV4>
  );
}

export function PlatformV7ShellBoundary({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  const pathname = usePathname();
  const publicPath = isPublicPlatformPath(pathname);

  return (
    <ToastProvider>
      <PlatformThemeSync />
      {publicPath ? children : <><ShellCopyNormalizer /><PlatformV7PrivateShell initialRole={initialRole}>{children}</PlatformV7PrivateShell></>}
    </ToastProvider>
  );
}
