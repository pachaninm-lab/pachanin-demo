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

const roleMobileContentIntegrity = `
  @media(max-width:767px){
    .pc-v4-main main,.pc-v4-main > main,.pc-v4-main > div{gap:12px!important}
    .pc-v4-main main > *,.pc-v4-main > main > *,.pc-v4-main > div > *{min-width:0!important;max-width:100%!important}
  }
`;

const buyerMobile = `@media(max-width:767px){.pc-v7-buyer-rfq-list{gap:8px!important}.pc-v7-buyer-kpi{grid-template-columns:1fr 1fr!important}}`;
const sellerMobile = `@media(max-width:767px){.pc-v7-seller-lots{gap:8px!important}.pc-v7-seller-kpi{grid-template-columns:1fr 1fr!important}}`;
const bankMobile = `@media(max-width:767px){.pc-v7-bank-basis{gap:8px!important}.pc-v7-bank-kpi{grid-template-columns:1fr 1fr!important}}`;
const complianceMobile = `@media(max-width:767px){.pc-v7-compliance-list{gap:8px!important}.pc-v7-compliance-kpi{grid-template-columns:1fr 1fr!important}}`;
const operatorMobile = `@media(max-width:767px){.pc-v7-control-tower{gap:8px!important}.pc-v7-operator-kpi{grid-template-columns:1fr 1fr!important}}`;

function FieldShellPolicy() {
  return <style dangerouslySetInnerHTML={{ __html: `${base}${roleMobileContentIntegrity}.pc-v4-search,.pc-v4-select,.pc-v4-mobile-role,.pc-v4-stage,.pc-v4-meta,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 66px)!important}` }} />;
}

function RoleScopedShellPolicy({ roleScopedExtra }: { roleScopedExtra: string }) {
  return <style dangerouslySetInnerHTML={{ __html: `${base}${roleMobileContentIntegrity}${roleScopedExtra}.pc-v4-search,nav[data-testid='platform-v7-work-route-nav']{display:none!important}.pc-v4-top{grid-template-columns:auto minmax(0,1fr) auto!important}.pc-v4-main{padding-top:calc(var(--pc-header-offset) + 8px)!important}` }} />;
}

function OperatorShellPolicy() {
  return <style dangerouslySetInnerHTML={{ __html: `${base}${roleMobileContentIntegrity}${operatorMobile}` }} />;
}

export function ScopedShellGuard() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  const shellPolicy = getShellPolicy(role, pathname);

  const roleScopedExtra =
    role === 'buyer' ? buyerMobile :
    role === 'seller' ? sellerMobile :
    role === 'bank' ? bankMobile :
    role === 'compliance' ? complianceMobile : '';

  if (shellPolicy === 'field') return <FieldShellPolicy />;
  if (shellPolicy === 'role-scoped') return <RoleScopedShellPolicy roleScopedExtra={roleScopedExtra} />;
  return <OperatorShellPolicy />;
}
