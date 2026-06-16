'use client';

import * as React from 'react';

const cleanupCss = `
.pc-shell-root-v4[data-public-entry='true']{--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{padding-bottom:max(64px,env(safe-area-inset-bottom))!important}
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

export function PublicEntryCleanup() {
  React.useEffect(() => {
    function sync() {
      const publicEntry = document.querySelector('.pc-v7-public-entry');
      const shell = publicEntry?.closest('.pc-shell-root-v4') as HTMLElement | null;
      const allShells = document.querySelectorAll<HTMLElement>('.pc-shell-root-v4[data-public-entry]');
      allShells.forEach((item) => {
        if (item !== shell) delete item.dataset.publicEntry;
      });
      if (shell) shell.dataset.publicEntry = 'true';
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
