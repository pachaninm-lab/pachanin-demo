import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
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
import { PlatformV7LeadCapture } from '@/components/platform-v7/PlatformV7LeadCapture';
import { PublicEntryInteractiveTour } from '@/components/platform-v7/PublicEntryInteractiveTour';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';
import '@/styles/mobile-polish.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-shell-clarity.css';
import '@/styles/platform-v7-work-surfaces.css';
import '@/styles/platform-v7-mobile-excellence.css';
import '@/styles/platform-v7-premium-visual-polish.css';
import '@/styles/platform-v7-final-polish.css';
import '@/styles/platform-v7-living-deal.css';
import '@/styles/platform-v7-premium-cockpit.css';
import '@/styles/platform-v7-entry-fix.css';
import '@/styles/platform-v7-mobile-hardening.css';
import '@/styles/platform-v7-mobile-reflow-p0.css';
import '@/styles/platform-v7-shell-restore.css';
import '@/styles/platform-v7-register-header-override.css';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const platformUrl = `${siteUrl}/platform-v7`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки',
    template: '%s | Прозрачная Цена',
  },
  description:
    'Прозрачная Цена — controlled pilot / pre-integration контур исполнения зерновой сделки: логистика, приёмка, качество, документы, расчёт, спор и доказательства.',
  applicationName: 'Прозрачная Цена',
  keywords: [
    'исполнение зерновой сделки',
    'цифровой контур зерновой сделки',
    'приёмка зерна',
    'качество зерна',
    'документы зерновой сделки',
    'расчёт по зерновой сделке',
    'спор по качеству зерна',
    'логистика зерна',
    'элеватор приёмка зерна',
    'СДИЗ зерно документы',
    'контроль исполнения сделки',
    'агрофинтех зерно',
  ],
  alternates: {
    canonical: platformUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: platformUrl,
    siteName: 'Прозрачная Цена',
    title: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки',
    description:
      'Контур controlled pilot / pre-integration для исполнения зерновой сделки: рейс, приёмка, качество, документы, расчёт, спор и доказательства.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

const PUBLIC_EXACT_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_EXACT_PATHS.has(pathname);
}

const VALID_ROLES = new Set<PlatformRole>([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

const shellRestoreCss = `
html body .pc-shell-root-v4 style{display:none!important}
html body .pc-shell-root-v4 .pc-v4-header{position:fixed!important;inset:0 0 auto 0!important;z-index:1200!important;transform:none!important;will-change:auto!important;background:color-mix(in srgb,var(--pc-bg-header) 96%,transparent)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;border-bottom:1px solid var(--pc-border)!important;box-shadow:0 10px 30px rgba(7,22,17,.08)!important}
html body .pc-shell-root-v4 .pc-v4-main{padding-top:calc(var(--pc-header-offset) + 12px)!important}
html body .pc-shell-root-v4 .pc-v7-public-entry{padding-top:70px!important}
html body .pc-shell-root-v4 .pc-v7-public-entry .entry-header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:1400!important;background:rgba(255,255,255,.98)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 12px 30px rgba(7,22,17,.08)!important;transform:none!important}
html body .pc-shell-root-v4 .pc-v7-login-single .login-top{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:1400!important;padding:10px 16px!important;margin:0!important;background:rgba(255,255,255,.96)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 12px 30px rgba(7,22,17,.06)!important;border-radius:0 0 22px 22px!important}
html body .pc-shell-root-v4 .pc-v7-login-single{padding-top:70px!important}
html body .pc-shell-root-v4 .pc-v7-public-entry section[id]{scroll-margin-top:92px!important}
html body .pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-header,html body .pc-shell-root-v4:has(.pc-v7-login-single) .pc-v4-header{display:none!important}
html body .pc-shell-root-v4 .pc-v4-main:has(.pc-v7-public-entry),html body .pc-shell-root-v4 .pc-v4-main:has(.pc-v7-login-single){padding-top:0!important}
@media (max-width:767px){
  html body .pc-shell-root-v4 .pc-v4-header{min-block-size:58px!important;max-block-size:64px!important}
  html body .pc-shell-root-v4 .pc-v4-header-inner{position:relative!important;overflow:visible!important;padding:8px!important;min-block-size:56px!important;max-block-size:60px!important}
  html body .pc-shell-root-v4 .pc-v4-top{display:grid!important;grid-template-columns:38px 42px minmax(0,1fr)!important;gap:6px!important;align-items:center!important;inline-size:100%!important;max-inline-size:100%!important;min-block-size:40px!important;overflow:visible!important}
  html body .pc-shell-root-v4 .pc-v4-top>button[aria-label='Открыть меню']{grid-column:1!important;display:inline-flex!important;inline-size:38px!important;min-inline-size:38px!important;max-inline-size:38px!important;block-size:38px!important;min-block-size:38px!important;visibility:visible!important;opacity:1!important}
  html body .pc-shell-root-v4 .pc-v4-brand{grid-column:2!important;display:inline-flex!important;inline-size:42px!important;min-inline-size:42px!important;max-inline-size:42px!important;block-size:40px!important;align-items:center!important;justify-content:center!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
  html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]{display:inline-flex!important;inline-size:38px!important;min-inline-size:38px!important;max-inline-size:38px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important;flex:0 0 38px!important;visibility:visible!important;opacity:1!important;overflow:visible!important}
  html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden] img{display:block!important;inline-size:100%!important;block-size:100%!important;max-inline-size:none!important;visibility:visible!important;opacity:1!important}
  html body .pc-shell-root-v4 .pc-v4-brand>span:not([aria-hidden]){display:none!important}
  html body .pc-shell-root-v4 .pc-v4-actions{grid-column:3!important;position:static!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:0!important;inline-size:100%!important;max-inline-size:100%!important;min-inline-size:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
  html body .pc-shell-root-v4 .pc-v4-stage,html body .pc-shell-root-v4 .pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}
  html body .pc-shell-root-v4 .pc-v4-search strong,html body .pc-shell-root-v4 .pc-v4-search span{display:none!important}
  html body .pc-shell-root-v4 .pc-v7-public-entry{padding-top:60px!important}
  html body .pc-shell-root-v4 .pc-v7-public-entry .entry-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:1400!important;min-height:60px!important;padding:8px 14px!important}
  html body .pc-shell-root-v4 .pc-v7-login-single{padding-top:60px!important}
  html body .pc-shell-root-v4 .pc-v7-login-single .login-top{position:fixed!important;top:0!important;left:0!important;right:0!important;padding:8px 14px!important;border-radius:0 0 18px 18px!important}
  html body .pc-shell-root-v4 .pc-v7-public-entry section[id]{scroll-margin-top:74px!important}
  html body .pc-shell-root-v4 .p7-public-tour-trigger{left:50%!important;right:auto!important;bottom:max(18px,env(safe-area-inset-bottom))!important;width:min(520px,calc(100vw - 44px))!important;min-height:54px!important;transform:translateX(-50%)!important;justify-content:center!important;text-align:center!important;z-index:940!important}
  html body .pc-shell-root-v4 .p7-public-tour-trigger:hover{transform:translateX(-50%) translateY(-1px)!important}
  html body .pc-shell-root-v4 .p7-public-tour-trigger span{display:inline-block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  html body .pc-shell-root-v4 .pc-v7-notice-panel,html body .pc-shell-root-v4 .p7-note-panel,html body .pc-shell-root-v4 .p7-calc-panel{position:fixed!important;left:10px!important;right:10px!important;top:64px!important;width:auto!important;max-width:none!important;z-index:900!important}
  html body .pc-shell-root-v4 .pc-v7-role-dock{display:block!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:700!important;visibility:visible!important;opacity:1!important;transform:none!important;pointer-events:auto!important}
  html body .pc-shell-root-v4 .pc-v7-assistant-widget{right:12px!important;bottom:calc(env(safe-area-inset-bottom) + 92px)!important;inline-size:46px!important;block-size:46px!important;min-height:46px!important;max-width:46px!important;padding:0!important;border-radius:18px!important;justify-content:center!important}
  html body .pc-shell-root-v4 .pc-v7-assistant-widget span{display:none!important}
  html body .pc-shell-root-v4 .seller-cockpit{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;inline-size:100%!important;max-inline-size:100%!important;min-inline-size:0!important;margin:0!important;overflow:hidden!important;grid-template-columns:1fr!important;transform:none!important}
  html body .pc-shell-root-v4 .seller-cockpit>style{display:none!important;visibility:hidden!important;inline-size:0!important;block-size:0!important;overflow:hidden!important}
  html body .pc-shell-root-v4 .seller-cockpit>:not(style){display:block!important;inline-size:100%!important;max-inline-size:100%!important;min-inline-size:0!important;flex:0 0 auto!important;grid-column:1/-1!important;margin-inline:0!important;overflow:hidden!important}
  html body .pc-shell-root-v4 .seller-command-card,html body .pc-shell-root-v4 .seller-detail-hero{display:grid!important;inline-size:100%!important;max-inline-size:100%!important;grid-template-columns:1fr!important;overflow:hidden!important}
  html body .pc-shell-root-v4 .seller-detail-hero>div:first-child{display:grid!important;grid-template-columns:1fr!important;inline-size:100%!important;gap:12px!important}
  html body .pc-shell-root-v4 .seller-command-facts,html body .pc-shell-root-v4 .seller-kpis,html body .pc-shell-root-v4 .seller-hero-actions,html body .pc-shell-root-v4 .seller-fact-grid,html body .pc-shell-root-v4 .seller-path-grid,html body .pc-shell-root-v4 .seller-lot-grid{display:grid!important;grid-template-columns:1fr!important;inline-size:100%!important;max-inline-size:100%!important}
  html body .pc-shell-root-v4 .seller-command-card h1{font-size:clamp(28px,8.4vw,36px)!important;line-height:1.03!important;letter-spacing:-.045em!important}
  html body .pc-shell-root-v4 .seller-command-actions{display:grid!important;grid-template-columns:1fr!important;inline-size:100%!important;gap:8px!important}
  html body .pc-shell-root-v4 .seller-cockpit [style*='grid-template-columns']{grid-template-columns:1fr!important}
}
@media (max-width:374px){
  html body .pc-shell-root-v4 .pc-v4-header{min-block-size:54px!important;max-block-size:58px!important}
  html body .pc-shell-root-v4 .pc-v4-header-inner{padding:7px 6px!important;min-block-size:52px!important;max-block-size:56px!important}
  html body .pc-shell-root-v4 .pc-v4-top{grid-template-columns:34px 38px minmax(0,1fr)!important;gap:4px!important}
  html body .pc-shell-root-v4 .pc-v7-public-entry{padding-top:56px!important}
  html body .pc-shell-root-v4 .pc-v7-public-entry .entry-header,html body .pc-shell-root-v4 .pc-v7-login-single .login-top{top:0!important;min-height:56px!important}
  html body .pc-shell-root-v4 .p7-public-tour-trigger{width:min(360px,calc(100vw - 28px))!important}
}
`;

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const rawRole = headerStore.get('x-pc-role');
  const pathname = headerStore.get('x-pc-pathname');
  const initialRole: PlatformRole = rawRole && VALID_ROLES.has(rawRole as PlatformRole) ? (rawRole as PlatformRole) : 'operator';

  if (isPublicPath(pathname)) {
    return (
      <ToastProvider>
        <PlatformThemeSync />
        {children}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <ShellCopyNormalizer />
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
          <PublicEntryInteractiveTour />
          {children}
          <PlatformV7LeadCapture />
          <style dangerouslySetInnerHTML={{ __html: shellRestoreCss }} />
        </>
      </AppShellV4>
    </ToastProvider>
  );
}
