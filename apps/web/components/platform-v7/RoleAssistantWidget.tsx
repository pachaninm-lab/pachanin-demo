'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot } from 'lucide-react';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

export function RoleAssistantWidget() {
  const pathname = usePathname();
  const path = normalize(pathname);

  if (PUBLIC_PATHS.has(path)) return null;

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
        @media(max-width:767px){
          .pc-v4-header{display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;inset:0 0 auto 0!important;z-index:740!important;transform:none!important}
          .pc-v4-header-inner{position:relative!important;overflow:visible!important;width:100%!important;max-width:100%!important;padding:calc(env(safe-area-inset-top) + 7px) 10px 7px!important}
          .pc-v4-top{display:grid!important;grid-template-columns:42px 46px minmax(0,1fr)!important;gap:7px!important;align-items:center!important;width:100%!important;max-width:100%!important;min-height:44px!important;overflow:visible!important}
          .pc-v4-brand{display:inline-flex!important;width:46px!important;min-width:46px!important;max-width:46px!important;height:44px!important;align-items:center!important;justify-content:center!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
          .pc-v4-brand>span[aria-hidden]{display:inline-flex!important;width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important;flex:0 0 40px!important;visibility:visible!important;opacity:1!important;overflow:visible!important}
          .pc-v4-brand>span[aria-hidden] img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;visibility:visible!important;opacity:1!important}
          .pc-v4-brand>span:not([aria-hidden]){display:none!important}
          .pc-v4-actions{position:static!important;display:flex!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
          .pc-v4-search,.pc-v4-stage,.p7-role-support{display:none!important}
          .pc-v4-theme-toggle,.p7-note-widget,.pc-v7-notice-wrap,.pc-v7-logout-btn,.p7-calc-widget{display:inline-flex!important;flex:0 0 38px!important;width:38px!important;min-width:38px!important;max-width:38px!important;height:38px!important;min-height:38px!important;visibility:visible!important;opacity:1!important}
          .pc-v4-theme-toggle{order:10!important}.p7-note-widget{order:20!important}.pc-v7-notice-wrap{order:30!important}.pc-v7-logout-btn{order:40!important}.p7-calc-widget{order:50!important}
          .seller-cockpit{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;overflow:hidden!important;grid-template-columns:1fr!important;transform:none!important}
          .seller-cockpit>*{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;flex:0 0 auto!important;grid-column:1/-1!important;margin-left:0!important;margin-right:0!important;overflow:hidden!important}
          .seller-command-card,.seller-detail-hero{display:grid!important;width:100%!important;max-width:100%!important;grid-template-columns:1fr!important;overflow:hidden!important}
          .seller-detail-hero>div:first-child{display:grid!important;grid-template-columns:1fr!important;width:100%!important;gap:12px!important}
          .seller-command-facts,.seller-kpis,.seller-hero-actions,.seller-fact-grid,.seller-path-grid,.seller-lot-grid{display:grid!important;grid-template-columns:1fr!important;width:100%!important;max-width:100%!important}
          .seller-command-card h1{font-size:clamp(28px,8.4vw,36px)!important;line-height:1.03!important;letter-spacing:-.045em!important}
          .seller-command-actions{display:grid!important;grid-template-columns:1fr!important;width:100%!important;gap:8px!important}
          .seller-cockpit [style*='grid-template-columns']{grid-template-columns:1fr!important}
        }
      `}</style>
      <Link className="pc-v7-assistant-widget" href={PLATFORM_V7_AI_ROUTE} data-active={path === PLATFORM_V7_AI_ROUTE ? 'true' : 'false'} aria-label="Открыть помощник роли" title="Помощник роли">
        <Bot aria-hidden="true" />
        <span>Помощник роли</span>
      </Link>
    </>
  );
}
