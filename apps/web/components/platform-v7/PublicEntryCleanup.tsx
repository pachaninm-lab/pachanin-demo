'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

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
.pc-shell-root-v4[data-public-entry='true'] [data-entry-click='true']{cursor:pointer!important}
.pc-shell-root-v4[data-public-entry='true'] [data-entry-click='true']:focus-visible{outline:3px solid rgba(0,122,47,.35)!important;outline-offset:3px!important}
@media(max-width:980px){
  .pc-shell-root-v4[data-public-entry='true'] .entry-header{min-height:64px!important;padding:10px 16px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-demo,.pc-shell-root-v4[data-public-entry='true'] .entry-desktop-nav{display:none!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero{padding-top:24px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1{font-size:clamp(34px,10.8vw,46px)!important;line-height:1!important;letter-spacing:-.055em!important;font-weight:920!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero p{font-size:17px!important;line-height:1.4!important;font-weight:540!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;overflow:visible!important;padding:0!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile{min-height:0!important;grid-template-columns:32px 46px minmax(0,1fr)!important;justify-items:start!important;align-items:center!important;text-align:left!important;padding:14px!important;gap:10px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile:not(:last-child)::after{content:''!important;position:absolute!important;left:52px!important;top:calc(100% - 3px)!important;right:auto!important;width:2px!important;height:14px!important;background:rgba(0,122,47,.22)!important;border-radius:99px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-index{grid-row:1 / span 2!important;align-self:center!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-icon{grid-row:1 / span 2!important;width:44px!important;height:44px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile strong{font-size:16px!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-process-tile small{grid-column:3!important;font-size:12.4px!important;line-height:1.32!important}
  .pc-shell-root-v4[data-public-entry='true'] .entry-trust-strip{margin-bottom:72px!important}
}
`;

type ClickTarget = { selector: string; href: string };

const clickTargets: ClickTarget[] = [
  { selector: '.entry-hero-visual', href: '/platform-v7/open' },
  { selector: '.entry-icon-button[aria-label="Помощь"]', href: '/platform-v7/support?role=operator' },
  { selector: '.entry-menu-button', href: '#roles' },
  { selector: '.entry-control-tile:nth-child(1)', href: '/platform-v7/bank' },
  { selector: '.entry-control-tile:nth-child(2)', href: '/platform-v7/docs' },
  { selector: '.entry-control-tile:nth-child(3)', href: '/platform-v7/logistics' },
  { selector: '.entry-control-tile:nth-child(4)', href: '/platform-v7/lab' },
  { selector: '.entry-process-tile:nth-child(1)', href: '/platform-v7/open' },
  { selector: '.entry-process-tile:nth-child(2)', href: '/platform-v7/deals' },
  { selector: '.entry-process-tile:nth-child(3)', href: '/platform-v7/logistics' },
  { selector: '.entry-process-tile:nth-child(4)', href: '/platform-v7/elevator' },
  { selector: '.entry-process-tile:nth-child(5)', href: '/platform-v7/docs' },
  { selector: '.entry-process-tile:nth-child(6)', href: '/platform-v7/bank' },
  { selector: '.entry-process-tile:nth-child(7)', href: '/platform-v7/disputes' },
  { selector: '.entry-trust-item:nth-child(1)', href: '/platform-v7/open' },
  { selector: '.entry-trust-item:nth-child(2)', href: '/platform-v7/disputes' },
  { selector: '.entry-trust-item:nth-child(3)', href: '/platform-v7/docs' },
  { selector: '.entry-trust-item:nth-child(4)', href: '/platform-v7/bank' },
];

function bindClick(el: HTMLElement, href: string) {
  if (el.dataset.entryClick === 'true') return;
  el.dataset.entryClick = 'true';
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'link');
  el.addEventListener('click', () => {
    if (href.startsWith('#')) document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.location.assign(href);
  });
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    el.click();
  });
}

export function PublicEntryCleanup() {
  React.useEffect(() => {
    function sync() {
      const publicEntry = document.querySelector('.pc-v7-public-entry');
      const shell = publicEntry?.closest('.pc-shell-root-v4') as HTMLElement | null;
      const allShells = document.querySelectorAll<HTMLElement>('.pc-shell-root-v4[data-public-entry]');
      allShells.forEach((item) => {
        if (item !== shell) delete item.dataset.publicEntry;
      });
      if (!shell || !publicEntry) return;
      shell.dataset.publicEntry = 'true';

      const mark = publicEntry.querySelector<HTMLElement>('.entry-brand-mark');
      if (mark && mark.dataset.brandApplied !== 'true') {
        mark.innerHTML = '';
        const img = document.createElement('img');
        img.src = BRAND_LOGO_DATA_URI;
        img.alt = '';
        img.draggable = false;
        mark.appendChild(img);
        mark.dataset.brandApplied = 'true';
      }

      clickTargets.forEach((target) => {
        const el = publicEntry.querySelector<HTMLElement>(target.selector);
        if (el) bindClick(el, target.href);
      });
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
