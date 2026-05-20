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

function FieldShellPolicy(){return <style>{`${base}.pc-v4-search,.pc-v4-select,.pc-v4-mobile-role,.pc-v4-stage,.pc-v4-meta,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 66px)!important}`}</style>}
function RoleScopedShellPolicy(){return <style>{`${base}.pc-v4-search,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(var(--pc-header-offset) + 8px)!important}`}</style>}
function OperatorShellPolicy(){return <style>{base}</style>}

export function ScopedShellGuard(){
  const pathname = usePathname();
  const role = usePlatformV7RStore((state)=>state.role);
  const shellPolicy = getShellPolicy(role, pathname);
  if(shellPolicy==='field') return <FieldShellPolicy/>;
  if(shellPolicy==='role-scoped') return <RoleScopedShellPolicy/>;
  return <OperatorShellPolicy/>;
}
