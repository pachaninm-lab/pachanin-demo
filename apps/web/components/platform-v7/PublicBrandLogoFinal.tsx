'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const css = `
html body .pc-v7-public-entry .entry-header,
html body .pc-v7-login-single .login-top,
html body .p7-register-page .p7-register-header,
html body .pc-shell-root-v4 .pc-v4-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2200!important;width:100%!important;max-width:100%!important;background:rgba(255,255,255,.985)!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 10px 24px rgba(7,22,17,.07)!important;backdrop-filter:blur(18px)!important;transform:none!important;overflow:visible!important}
html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}
html body .pc-v7-login-single{padding-top:104px!important;scroll-padding-top:104px!important}
html body .p7-register-page{padding-top:90px!important;scroll-padding-top:90px!important}
html body .pc-v7-login-single .login-shell{max-width:1240px!important;margin:0 auto!important}
html body .pc-v7-login-single .login-top{height:72px!important;min-height:72px!important;padding:10px 28px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}
html body .p7-register-page .p7-register-header{height:72px!important;min-height:72px!important;padding:10px 28px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important}
html body .pc-v7-public-entry .entry-brand-mark,
html body .p7-register-page .p7-register-brand-mark,
html body .pc-v7-login-single .pc-global-brand-mark,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child,
html body .pc-header-brand>span:first-child,
html body .app-header-brand>span:first-child{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:transparent!important;background-image:none!important;color:inherit!important;box-shadow:none!important;border:0!important;padding:0!important;margin:0!important;overflow:visible!important;line-height:0!important;flex:0 0 auto!important}
html body .pc-v7-public-entry .entry-brand-mark img,
html body .p7-register-page .p7-register-brand-mark img,
html body .pc-v7-login-single .pc-global-brand-mark img,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child img,
html body .pc-header-brand>span:first-child img,
html body .app-header-brand>span:first-child img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important;opacity:1!important;visibility:visible!important}
html body .pc-v7-login-single .login-top a{display:inline-flex!important;align-items:center!important;gap:10px!important;color:#071611!important;font-weight:950!important;text-decoration:none!important}
html body .pc-v7-login-single .pc-global-brand-mark{width:42px!important;height:42px!important;min-width:42px!important}
@media(max-width:720px){
html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}
html body .pc-v7-login-single{padding-top:102px!important;scroll-padding-top:102px!important}
html body .p7-register-page{padding-top:88px!important;scroll-padding-top:88px!important}
html body .pc-v7-public-entry .entry-header{height:70px!important;min-height:70px!important;padding:10px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important}
html body .pc-v7-login-single .login-top{height:70px!important;min-height:70px!important;padding:10px 16px!important}
html body .p7-register-page .p7-register-header{height:70px!important;min-height:70px!important;padding:10px 16px!important}
html body .pc-v7-public-entry .entry-brand-mark,
html body .p7-register-page .p7-register-brand-mark,
html body .pc-v7-login-single .pc-global-brand-mark{width:42px!important;height:42px!important;min-width:42px!important}
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child{width:38px!important;height:38px!important;min-width:38px!important}
}
`;

function buildLogoImage() {
  const img = document.createElement('img');
  img.src = BRAND_LOGO_DATA_URI;
  img.alt = '';
  img.draggable = false;
  img.loading = 'eager';
  return img;
}

function lockIconLogo(mark: HTMLElement) {
  const current = mark.querySelector('img');
  if (mark.dataset.brandLogoLocked === 'true' && current?.getAttribute('src') === BRAND_LOGO_DATA_URI) return;
  mark.replaceChildren(buildLogoImage());
  mark.dataset.brandLogoLocked = 'true';
}

function ensureLoginBrandLogo(link: HTMLAnchorElement) {
  let mark = link.querySelector<HTMLElement>('.pc-global-brand-mark');
  if (!mark) {
    mark = document.createElement('span');
    mark.className = 'pc-global-brand-mark';
    link.prepend(mark);
  }
  lockIconLogo(mark);
}

function applyBrandLogo() {
  document
    .querySelectorAll<HTMLElement>(
      '.pc-v7-public-entry .entry-brand-mark, .p7-register-page .p7-register-brand-mark, .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child, .pc-header-brand>span:first-child, .app-header-brand>span:first-child',
    )
    .forEach(lockIconLogo);

  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-login-single .login-top a').forEach(ensureLoginBrandLogo);
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
