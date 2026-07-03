'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const css = `
html body .pc-v7-public-entry .entry-header,
html body .pc-shell-root-v4 .pc-v4-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2000!important;width:100%!important;max-width:100%!important;background:rgba(255,255,255,.98)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 10px 24px rgba(7,22,17,.07)!important;backdrop-filter:blur(18px)!important;transform:none!important;overflow:visible!important}
html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}
html body .pc-v7-public-entry .entry-brand-mark,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child,
html body .pc-header-brand>span:first-child,
html body .app-header-brand>span:first-child{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:transparent!important;background-image:none!important;color:inherit!important;box-shadow:none!important;border:0!important;padding:0!important;margin:0!important;overflow:visible!important;line-height:0!important;flex:0 0 auto!important}
html body .pc-v7-public-entry .entry-brand-mark img,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child img,
html body .pc-header-brand>span:first-child img,
html body .app-header-brand>span:first-child img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important;opacity:1!important;visibility:visible!important}
@media(max-width:720px){html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}html body .pc-v7-public-entry .entry-header{height:70px!important;min-height:70px!important;padding:10px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important}html body .pc-v7-public-entry .entry-brand-mark{width:42px!important;height:42px!important;min-width:42px!important}html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child{width:38px!important;height:38px!important;min-width:38px!important}}
`;

function lockLogo(mark: HTMLElement) {
  const img = document.createElement('img');
  img.src = BRAND_LOGO_DATA_URI;
  img.alt = '';
  img.draggable = false;
  img.loading = 'eager';
  mark.replaceChildren(img);
  mark.dataset.brandLogoLocked = 'true';
}

function applyBrandLogo() {
  document
    .querySelectorAll<HTMLElement>(
      '.pc-v7-public-entry .entry-brand-mark, .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child, .pc-header-brand>span:first-child, .app-header-brand>span:first-child',
    )
    .forEach((mark) => {
      const current = mark.querySelector('img');
      if (mark.dataset.brandLogoLocked === 'true' && current?.getAttribute('src') === BRAND_LOGO_DATA_URI) return;
      lockLogo(mark);
    });
}

export function PublicBrandLogoFinal() {
  React.useEffect(() => {
    applyBrandLogo();
    const timers = [80, 220, 600, 1200, 2500].map((delay) => window.setTimeout(applyBrandLogo, delay));
    const observer = new MutationObserver(applyBrandLogo);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
