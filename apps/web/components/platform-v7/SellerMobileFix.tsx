'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function SellerMobileFix() {
  const pathname = usePathname();
  useEffect(() => {
    const active = (pathname || '').startsWith('/platform-v7/seller');
    document.body.classList.toggle('seller-mobile-fix', active);
    return () => document.body.classList.remove('seller-mobile-fix');
  }, [pathname]);
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `@media(max-width:767px){body.seller-mobile-fix{overflow-x:hidden!important}body.seller-mobile-fix .pc-v4-top>button:first-child{display:none!important}body.seller-mobile-fix .pc-v4-main{max-width:100%!important;overflow-x:hidden!important;padding-left:10px!important;padding-right:10px!important;padding-bottom:max(128px,calc(env(safe-area-inset-bottom,0px) + 104px))!important}body.seller-mobile-fix .seller-cockpit{display:flex!important;flex-direction:column!important;gap:12px!important;width:100%!important;max-width:100%!important;overflow-x:hidden!important}body.seller-mobile-fix .seller-cockpit>*{width:100%!important;max-width:100%!important;min-width:0!important;grid-column:1/-1!important;overflow-x:hidden!important}body.seller-mobile-fix .seller-command-card{order:1!important;background:#fff!important;color:#071611!important;border-radius:24px!important;padding:16px!important}body.seller-mobile-fix .seller-detail-hero{order:2!important;background:#fff!important;color:#071611!important;border-radius:24px!important;padding:16px!important}body.seller-mobile-fix #first-screen{order:3!important}body.seller-mobile-fix #documents{order:4!important}body.seller-mobile-fix #money{order:5!important}body.seller-mobile-fix #blockers{order:6!important}body.seller-mobile-fix #actions{order:7!important}body.seller-mobile-fix #journal{order:8!important}body.seller-mobile-fix #parties{order:9!important}body.seller-mobile-fix .seller-cockpit h1,body.seller-mobile-fix .pc-prem-hero__title{font-size:34px!important;line-height:1.04!important;color:#071611!important}body.seller-mobile-fix .seller-command-facts,body.seller-mobile-fix .seller-command-actions,body.seller-mobile-fix .seller-fact-grid,body.seller-mobile-fix .seller-path-grid,body.seller-mobile-fix .seller-lot-grid,body.seller-mobile-fix .seller-kpis,body.seller-mobile-fix .pc-prem-kpis{grid-template-columns:1fr!important}body.seller-mobile-fix .caption{display:none!important}}`;
