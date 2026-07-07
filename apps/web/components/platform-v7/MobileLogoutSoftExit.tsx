'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const LOGOUT_TARGET = '/platform-v7/login?logout=1';
const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/deal-flow', '/platform-v7/demo', '/platform-v7/docs']);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function clearClientSession() {
  try {
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
  } catch {}
  try {
    document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
    document.cookie = 'pc-session=; Max-Age=0; Path=/; SameSite=Lax';
  } catch {}
}

function cleanupPublicEntryArtifacts() {
  document.body.classList.remove('seller-mobile-fix');
  document.querySelectorAll<HTMLElement>('.p7-mobile-tool-panel,[data-public-platform-handoff="true"]').forEach((item) => item.remove());
}

export function MobileLogoutSoftExit() {
  const router = useRouter();
  const pathname = usePathname();
  const path = normalize(pathname);

  useEffect(() => {
    const active = path.startsWith('/platform-v7/seller');
    document.body.classList.toggle('seller-mobile-fix', active);
    if (PUBLIC_PATHS.has(path)) cleanupPublicEntryArtifacts();
    return () => document.body.classList.remove('seller-mobile-fix');
  }, [path]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('.p7-mobile-danger,.pc-v7-logout-btn,[data-platform-v7-logout="true"]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      clearClientSession();
      cleanupPublicEntryArtifacts();
      router.replace(LOGOUT_TARGET, { scroll: true });
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        if (!window.location.pathname.startsWith('/platform-v7/login')) window.location.assign(LOGOUT_TARGET);
      });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `@media(max-width:767px){body.seller-mobile-fix{overflow-x:hidden!important}body.seller-mobile-fix .pc-v4-top>button:first-child{display:none!important}body.seller-mobile-fix .pc-v4-main{max-width:100vw!important;overflow-x:hidden!important;padding-left:10px!important;padding-right:10px!important;padding-bottom:112px!important}body.seller-mobile-fix .seller-cockpit{display:flex!important;flex-direction:column!important;gap:12px!important;width:100%!important;max-width:100%!important;overflow-x:hidden!important}body.seller-mobile-fix .seller-cockpit>*{width:100%!important;max-width:100%!important;min-width:0!important;grid-column:1/-1!important;overflow-x:hidden!important}body.seller-mobile-fix .seller-command-card{order:1!important;background:#fff!important;color:#071611!important;border-radius:24px!important;padding:16px!important}body.seller-mobile-fix .seller-detail-hero{order:2!important;background:#fff!important;color:#071611!important;border-radius:24px!important;padding:16px!important}body.seller-mobile-fix #first-screen{order:3!important}body.seller-mobile-fix #documents{order:4!important}body.seller-mobile-fix #money{order:5!important}body.seller-mobile-fix #blockers{order:6!important}body.seller-mobile-fix #actions{order:7!important}body.seller-mobile-fix #journal{order:8!important}body.seller-mobile-fix #parties{order:9!important}body.seller-mobile-fix .seller-cockpit h1,body.seller-mobile-fix .pc-prem-hero__title{font-size:34px!important;line-height:1.04!important;color:#071611!important}body.seller-mobile-fix .seller-command-facts,body.seller-mobile-fix .seller-command-actions,body.seller-mobile-fix .seller-fact-grid,body.seller-mobile-fix .seller-path-grid,body.seller-mobile-fix .seller-lot-grid,body.seller-mobile-fix .seller-kpis,body.seller-mobile-fix .pc-prem-kpis{grid-template-columns:1fr!important}body.seller-mobile-fix .caption{display:none!important}}`;
