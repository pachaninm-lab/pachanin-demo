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

// Мобильное «сворачивание хвоста»: на узком экране кабинет показывает фокус-верх
// (плашка статуса, блокер, герой с действием, ключевая карточка), а длинный
// детальный хвост скрывается — детали доступны через нижнюю панель и подэкраны.
// Селекторы привязаны к реальному контейнеру кабинета (см. структуру ниже).
const buyerMobile = `
  @media(max-width:767px){
    .pc-v4-main main[data-platform-v7-buyer-cockpit-pass='true']{gap:12px!important}
    .pc-v4-main main[data-platform-v7-buyer-cockpit-pass='true'] > *:nth-child(n+5){display:none!important}
    .pc-v4-main > section[data-testid]{display:none!important}
  }
`;

const sellerMobile = `
  @media(max-width:767px){
    .pc-v4-main main[data-platform-v7-seller-cockpit-pass='true']{gap:12px!important}
    .pc-v4-main main[data-platform-v7-seller-cockpit-pass='true'] > *:nth-child(n+5){display:none!important}
    .pc-v4-main > section[data-testid]{display:none!important}
  }
`;

const bankMobile = `
  @media(max-width:767px){
    .pc-v4-main main > *:nth-child(n+6):not(details){display:none!important}
  }
`;

const operatorMobile = `
  @media(max-width:767px){
    .pc-v4-main > main > *:nth-child(n+6){display:none!important}
  }
`;

const complianceMobile = `
  @media(max-width:767px){
    .pc-v4-main div[data-platform-v7-compliance-cockpit-pass='true'] > *:nth-child(n+3){display:none!important}
  }
`;

function FieldShellPolicy(){return <style dangerouslySetInnerHTML={{ __html: `${base}.pc-v4-search,.pc-v4-select,.pc-v4-mobile-role,.pc-v4-stage,.pc-v4-meta,.pc-v4-drawer,.pc-v4-iconbtn[aria-label='Открыть меню'],nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 66px)!important}` }} />}
function RoleScopedShellPolicy({extra=''}:{extra?:string}){return <style dangerouslySetInnerHTML={{ __html: `${base}${extra}.pc-v4-search,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(var(--pc-header-offset) + 8px)!important}` }} />}
function OperatorShellPolicy({extra=''}:{extra?:string}){return <style dangerouslySetInnerHTML={{ __html: `${base}${extra}` }} />}

function roleScopedExtra(pathname: string): string {
  if(pathname.startsWith('/platform-v7/surveyor')) return surveyorMobile;
  if(pathname.startsWith('/platform-v7/buyer')) return buyerMobile;
  if(pathname.startsWith('/platform-v7/seller')) return sellerMobile;
  if(pathname.startsWith('/platform-v7/bank')) return bankMobile;
  if(pathname.startsWith('/platform-v7/compliance')) return complianceMobile;
  return '';
}

export function ScopedShellGuard(){
  const pathname = usePathname();
  const role = usePlatformV7RStore((state)=>state.role);
  const shellPolicy = getShellPolicy(role, pathname);
  if(shellPolicy==='field') return <FieldShellPolicy/>;
  if(shellPolicy==='role-scoped') return <RoleScopedShellPolicy extra={roleScopedExtra(pathname)}/>;
  if(pathname.startsWith('/platform-v7/control-tower') || pathname.startsWith('/platform-v7/operator')) return <OperatorShellPolicy extra={operatorMobile}/>;
  return <OperatorShellPolicy extra=''/>;
}