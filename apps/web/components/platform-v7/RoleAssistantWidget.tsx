'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileSearch2 } from 'lucide-react';
import { UxFinalQuietLayer } from '@/components/platform-v7/UxFinalQuietLayer';
import { WorkStepGuide } from '@/components/platform-v7/WorkStepGuide';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';

const PUBLIC_PATHS = new Set([
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

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

export function RoleAssistantWidget() {
  const pathname = usePathname();
  const path = normalize(pathname);

  if (PUBLIC_PATHS.has(path) || path.startsWith('/platform-v7/role-preview')) return null;

  return (
    <>
      <style>{`
        .pc-v7-role-dock a[href='/platform-v7/ai'],
        .pc-v7-safe-drawer-link[href='/platform-v7/ai'],
        .pc-v4-bottomnav a[href='/platform-v7/ai'],
        .pc-v7-role-dock button.pc-v7-role-dock-item{display:none!important}
        .pc-v7-assistant-widget{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom) + 92px);z-index:104;display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:min(240px,calc(100vw - 32px));padding:0 14px;border-radius:999px;border:1px solid var(--pc-accent-border);background:var(--pc-accent-bg);color:var(--pc-accent-strong);box-shadow:var(--pc-shadow-lg);text-decoration:none;font-size:12px;font-weight:950;line-height:1;backdrop-filter:blur(18px)}
        .pc-v7-assistant-widget[data-active='true']{background:var(--pc-accent);border-color:var(--pc-accent);color:white}
        .pc-v7-assistant-widget svg{width:17px;height:17px;flex:0 0 auto}
        @media(max-width:640px){.pc-v7-assistant-widget{right:12px;bottom:calc(env(safe-area-inset-bottom) + 82px);min-height:42px;padding:0 12px;font-size:11px}.pc-v7-assistant-widget span{max-width:136px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
      `}</style>
      <UxFinalQuietLayer />
      <WorkStepGuide />
      <style>{`
        [data-testid="platform-v7-work-step-guide"]{padding:8px!important;border-radius:16px!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row{display:flex!important;align-items:center!important;gap:7px!important;grid-template-columns:none!important;min-width:0!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row>div:first-child{min-width:86px!important;max-width:148px!important;flex:0 1 auto!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row>div:last-child{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;min-width:0!important;scrollbar-width:none!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row>div:last-child::-webkit-scrollbar{display:none!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row a{width:auto!important;min-height:32px!important;flex:0 0 auto!important;justify-content:center!important}
        [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row span{flex:0 0 auto}
        @media(max-width:640px){
          [data-testid="platform-v7-work-step-guide"]{padding:7px!important}
          [data-testid="platform-v7-work-step-guide"] .p7-work-actions-row>div:first-child{min-width:70px!important;max-width:104px!important;font-size:11px!important}
        }
      `}</style>
      <Link className="pc-v7-assistant-widget" href={PLATFORM_V7_AI_ROUTE} data-active={path === PLATFORM_V7_AI_ROUTE ? 'true' : 'false'} aria-label="Открыть разбор рабочего шага" title="Разбор рабочего шага">
        <FileSearch2 aria-hidden="true" />
        <span>Разбор шага</span>
      </Link>
    </>
  );
}
