'use client';

import { usePathname } from 'next/navigation';
import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const base = `
  .pc-v4-pilot-note,.pc-v4-statuses,.pc-v4-stage,.pc-v4-mobile-role,.pc-v4-select,[data-role-header-switcher-wrap='true'],[data-role-header-label='true']{display:none!important}
  .pc-v4-meta,.pc-v4-subtitle{display:none!important}
  nav[data-testid='platform-v7-work-route-nav']{display:none!important}
  @media(max-width:640px){
    .pc-shell-root-v4{--pc-header-offset:56px!important}
    .pc-v4-header-inner{height:56px!important;padding:calc(env(safe-area-inset-top) + 7px) 10px 7px!important}
    .pc-v4-title,.pc-v4-subtitle{display:none!important}
    .pc-v4-search{min-width:42px!important;max-width:42px!important;flex:0 0 42px!important}
    .pc-v4-main{padding-left:10px!important;padding-right:10px!important}
    .pc-v4-iconbtn{min-width:42px!important;min-height:42px!important}
    .pc-v4-brand{max-width:52px!important}
    .pc-v4-actions{min-width:0!important;gap:6px!important}
  }
`;

const surveyorMobile = `
  @media(max-width:767px){
    .pc-v4-main > div[style*='gap: 18px']{gap:10px!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child{padding:16px!important;border-radius:24px!important;gap:10px!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child p{display:none!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child > div:nth-child(2) > div:nth-child(n+3){display:none!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:first-child > div:nth-child(2) > div{padding:13px!important;border-radius:16px!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:nth-child(2),
    .pc-v4-main > div[style*='gap: 18px'] > section:nth-child(3),
    .pc-v4-main > div[style*='gap: 18px'] > div:nth-child(2),
    .pc-v4-main > div[style*='gap: 18px'] > div:nth-child(3){display:none!important}
    .pc-v4-main > div[style*='gap: 18px'] > section:last-child{padding:14px!important;border-radius:22px!important;gap:10px!important}
  }
`;

function FieldShellPolicy(){return <style>{`${base}.pc-v4-search,.pc-v4-select,.pc-v4-mobile-role,.pc-v4-stage,.pc-v4-meta,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 66px)!important}`}</style>}
function RoleScopedShellPolicy({extra=''}:{extra?:string}){return <style>{`${base}${extra}.pc-v4-search,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(var(--pc-header-offset) + 8px)!important}`}</style>}
function OperatorShellPolicy(){return <style>{base}</style>}

export function ScopedShellGuard(){
  const pathname = usePathname();
  const role = usePlatformV7RStore((state)=>state.role);
  const shellPolicy = getShellPolicy(role, pathname);
  if(shellPolicy==='field') return <FieldShellPolicy/>;
  if(shellPolicy==='role-scoped') return <RoleScopedShellPolicy extra={pathname.startsWith('/platform-v7/surveyor') ? surveyorMobile : ''}/>;
  return <OperatorShellPolicy/>;
}