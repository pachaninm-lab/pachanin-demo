'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

const cleanupCss = `
.pc-shell-root-v4[data-public-entry='true']{--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{padding-bottom:max(64px,env(safe-area-inset-bottom))!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{background:transparent!important;color:inherit!important;padding:0!important;overflow:visible!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;background:transparent!important}
@media(max-width:980px){
  .pc-shell-root-v4[data-public-entry='true'] .entry-header{min-height:64px!important;padding:10px 16px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-demo,.pc-shell-root-v4[data-public-entry='true'] .entry-desktop-nav{display:none!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero{padding-top:24px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1{font-size:clamp(34px,10.8vw,46px)!important;line-height:1!important;letter-spacing:-.055em!important;font-weight:920!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero p{font-size:17px!important;line-height:1.4!important;font-weight:540!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;overflow:visible!important;padding:0!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile{min-height:0!important;grid-template-columns:32px 46px minmax(0,1fr)!important;justify-items:start!important;align-items:center!important;text-align:left!important;padding:14px!important;gap:10px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-index{grid-row:1 / span 2!important;align-self:center!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-icon{grid-row:1 / span 2!important;width:44px!important;height:44px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile strong{font-size:16px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile small{grid-column:3!important;font-size:12.4px!important;line-height:1.32!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-trust-strip{margin-bottom:72px!important}
}
`;

function normalize(pathname: string) {
  return pathname.replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string) {
  const path = normalize(pathname);
  return PUBLIC_PATHS.has(path) || path.startsWith('/platform-v7/role-preview');
}

function rewritePublicLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('/platform-v7')) return;
    if (isPublicPath(href)) return;
    link.setAttribute('href', '/platform-v7/login');
    if ((link.textContent || '').trim()) link.textContent = 'Войти через единый вход';
  });
}

export function PublicEntryCleanup() {
  const pathname = usePathname() || '';
  const router = useRouter();

  React.useEffect(() => {
    if (!pathname.startsWith('/platform-v7')) return;
    if (isPublicPath(pathname)) return;
    router.replace('/platform-v7/login');
  }, [pathname, router]);

  React.useEffect(() => {
    function sync() {
      const publicEntry = document.querySelector('.pc-v7-public-entry');
      const openEntry = document.querySelector('[data-testid="platform-v7-open-walkthrough"]');
      const entry = (publicEntry || openEntry) as HTMLElement | null;
      const shell = entry?.closest('.pc-shell-root-v4') as HTMLElement | null;
      document.querySelectorAll<HTMLElement>('.pc-shell-root-v4[data-public-entry]').forEach((item) => {
        if (item !== shell) delete item.dataset.publicEntry;
      });
      if (!shell || !entry) return;
      shell.dataset.publicEntry = 'true';

      const mark = entry.querySelector<HTMLElement>('.entry-brand-mark');
      if (mark && mark.dataset.brandApplied !== 'true') {
        mark.innerHTML = '';
        const img = document.createElement('img');
        img.src = BRAND_LOGO_DATA_URI;
        img.alt = '';
        img.draggable = false;
        mark.appendChild(img);
        mark.dataset.brandApplied = 'true';
      }

      rewritePublicLinks(entry);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
