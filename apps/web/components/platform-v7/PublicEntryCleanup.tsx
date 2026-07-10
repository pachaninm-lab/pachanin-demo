'use client';

import * as React from 'react';

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/demo',
  '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

const cleanupCss = `
.pc-shell-root-v4:has(.pc-v7-public-entry),
.pc-shell-root-v4[data-public-entry='true']{--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-header,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-bottomnav,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-drawer,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-pilot-note,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-main,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
.pc-v7-public-entry{width:100%!important;max-width:100%!important;min-height:100dvh!important;overflow-x:hidden!important;contain:none!important;content-visibility:visible!important}
.pc-v7-public-entry .entry-hero,
.pc-v7-public-entry .entry-section,
.pc-v7-public-entry .entry-trust-strip{max-width:1220px!important;min-width:0!important;contain:none!important;content-visibility:visible!important}
.pc-v7-public-entry .entry-control-grid{contain:none!important;content-visibility:visible!important}
.pc-v7-public-entry .entry-control-tile{display:grid!important;opacity:1!important;visibility:visible!important;contain:none!important;content-visibility:visible!important}
@media (max-width:720px){
.pc-v7-public-entry .entry-control-grid{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;overflow:visible!important;min-height:0!important;height:auto!important;max-height:none!important}
.pc-v7-public-entry .entry-control-tile{width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;margin:0!important;padding:20px!important;border-radius:24px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 14px 34px rgba(7,22,17,.065)!important}
.pc-v7-public-entry .entry-process-row{display:flex!important;grid-template-columns:none!important;gap:10px!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory!important;padding:0 2px 8px!important;-webkit-overflow-scrolling:touch!important}
.pc-v7-public-entry .entry-process-row::-webkit-scrollbar{display:none!important}
.pc-v7-public-entry .entry-process-tile{flex:0 0 176px!important;min-width:176px!important;min-height:142px!important;text-align:left!important;display:grid!important;justify-items:start!important;align-content:start!important;padding:15px!important;border-radius:21px!important;scroll-snap-align:start!important}
.pc-v7-public-entry .entry-process-tile:not(:last-child)::after{display:none!important}
.pc-v7-public-entry .entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
}
`;

function normalize(pathname: string) {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(path: string) {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIX_PATHS.some((prefix) => path.startsWith(prefix));
}

function cleanupStaleArtifacts() {
  document.body.classList.remove('seller-mobile-fix');
  document.querySelectorAll<HTMLElement>('.p7-mobile-tool-panel,[data-public-platform-handoff="true"]').forEach((item) => item.remove());
  document.querySelectorAll<HTMLElement>('.pc-shell-root-v4[data-public-entry]').forEach((item) => delete item.dataset.publicEntry);
}

function normalizeDemoLinks(entry: ParentNode) {
  entry.querySelectorAll<HTMLAnchorElement>('a[href="/platform-v7/demo"],a[href^="/platform-v7/demo?"]').forEach((link) => {
    link.href = '/platform-v7/deal-flow';
    link.setAttribute('href', '/platform-v7/deal-flow');
  });
}

function markPublicShell(entry: HTMLElement) {
  const shell = entry.closest('.pc-shell-root-v4') as HTMLElement | null;
  if (shell) shell.dataset.publicEntry = 'true';
}

export function PublicEntryCleanup() {
  React.useEffect(() => {
    let cancelled = false;
    function sync() {
      if (cancelled) return;
      const path = normalize(window.location.pathname);
      if (!isPublicPath(path)) return;
      const entry = document.querySelector('.pc-v7-public-entry,[data-testid="platform-v7-open-walkthrough"]') as HTMLElement | null;
      cleanupStaleArtifacts();
      if (!entry) return;
      markPublicShell(entry);
      normalizeDemoLinks(entry);
      entry.querySelectorAll<HTMLElement>('.entry-control-tile').forEach((tile) => {
        tile.hidden = false;
        tile.removeAttribute('aria-hidden');
        tile.style.removeProperty('display');
        tile.style.removeProperty('visibility');
        tile.style.removeProperty('opacity');
      });
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 220, 600, 1200].map((delay) => window.setTimeout(sync, delay));
    window.addEventListener('pageshow', sync);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
