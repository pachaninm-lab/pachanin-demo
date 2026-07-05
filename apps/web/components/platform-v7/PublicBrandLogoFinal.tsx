'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const css = `
html body .pc-v7-public-entry .entry-header,
html body .pc-v7-login-single .login-header,
html body .pc-v7-login-single .login-top,
html body .p7-register-page .p7-register-header,
html body .p7-contact-page .p7-contact-header,
html body .p7-demo-page .p7-demo-header,
html body .p7-docs-page .p7-docs-header,
html body .p7-request-page .p7-request-header,
html body .pc-shell-root-v4 .pc-v4-header{
  position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2600!important;
  width:100%!important;max-width:100%!important;height:72px!important;min-height:72px!important;max-height:72px!important;
  padding:10px 28px!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-top:0!important;
  border-bottom:1px solid rgba(7,22,17,.08)!important;background:rgba(255,255,255,.985)!important;
  box-shadow:0 10px 24px rgba(7,22,17,.07)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;
  transform:none!important;overflow:visible!important;
}

html body .pc-v7-public-entry .entry-header,
html body .pc-v7-login-single .login-header,
html body .pc-v7-login-single .login-top{
  display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;
}

html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}
html body .pc-v7-login-single{padding-top:104px!important;scroll-padding-top:104px!important;padding-bottom:calc(156px + env(safe-area-inset-bottom,0px))!important}
html body .p7-register-page,
html body .p7-contact-page,
html body .p7-demo-page,
html body .p7-docs-page,
html body .p7-request-page{padding-top:90px!important;scroll-padding-top:90px!important}

html body .pc-v7-public-entry .entry-brand,
html body .pc-v7-login-single .login-brand,
html body .pc-v7-login-single .login-header>a:first-of-type,
html body .pc-v7-login-single .login-top>a:first-of-type,
html body .p7-register-page .p7-register-brand,
html body .p7-contact-page .p7-contact-brand,
html body .p7-demo-page .p7-demo-brand,
html body .p7-docs-page .p7-docs-brand,
html body .p7-request-page .p7-request-brand{
  display:inline-flex!important;align-items:center!important;gap:14px!important;min-width:0!important;color:#071611!important;text-decoration:none!important;font-weight:950!important;overflow:hidden!important;
}

html body .pc-v7-public-entry .entry-brand-mark,
html body .pc-v7-login-single .login-logo,
html body .pc-v7-login-single .pc-global-brand-mark,
html body .pc-v7-login-single .login-brand>span[aria-hidden],
html body .p7-register-page .p7-register-brand-mark,
html body .p7-contact-page .p7-contact-brand-mark,
html body .p7-demo-page .p7-demo-brand>span[aria-hidden]:first-child,
html body .p7-docs-page .p7-docs-brand>span:first-child,
html body .p7-request-page .p7-request-brand>span:first-child,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child,
html body .pc-header-brand>span:first-child,
html body .app-header-brand>span:first-child{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;width:56px!important;height:56px!important;min-width:56px!important;max-width:56px!important;min-height:56px!important;max-height:56px!important;
  background:rgba(0,122,47,.08)!important;background-image:none!important;color:#087a3b!important;box-shadow:none!important;border:0!important;border-radius:16px!important;padding:0!important;margin:0!important;overflow:hidden!important;line-height:0!important;flex:0 0 56px!important;
}

html body .pc-v7-public-entry .entry-brand-mark img,
html body .pc-v7-public-entry .entry-brand-mark svg,
html body .pc-v7-login-single .login-logo img,
html body .pc-v7-login-single .login-logo svg,
html body .pc-v7-login-single .pc-global-brand-mark img,
html body .pc-v7-login-single .login-brand img,
html body .p7-register-page .p7-register-brand-mark img,
html body .p7-contact-page .p7-contact-brand-mark img,
html body .p7-demo-page .p7-demo-brand>span[aria-hidden]:first-child img,
html body .p7-docs-page .p7-docs-brand>span:first-child img,
html body .p7-request-page .p7-request-brand>span:first-child img,
html body .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child img,
html body .pc-header-brand>span:first-child img,
html body .app-header-brand>span:first-child img{
  display:block!important;width:32px!important;height:32px!important;max-width:32px!important;max-height:32px!important;object-fit:contain!important;object-position:center!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important;opacity:1!important;visibility:visible!important;
}

html body .pc-v7-public-entry .entry-brand strong,
html body .pc-v7-login-single .login-brand b,
html body .pc-v7-login-single .login-brand strong,
html body .p7-register-page .p7-register-brand strong,
html body .p7-contact-page .p7-contact-brand strong,
html body .p7-demo-page .p7-demo-brand strong{
  display:block!important;font-size:20px!important;line-height:1.05!important;letter-spacing:-.035em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#071611!important;font-weight:950!important;
}

html body .pc-v7-public-entry .entry-brand small,
html body .pc-v7-login-single .login-brand small{display:none!important}

html body .pc-v7-public-entry .entry-login,
html body .pc-v7-login-single .login-back,
html body .pc-v7-login-single .login-header>a:last-child,
html body .pc-v7-login-single .login-top>a:last-child{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;height:54px!important;min-height:54px!important;min-width:108px!important;padding:0 24px!important;border-radius:23px!important;background:#fff!important;color:#071611!important;border:1px solid rgba(7,22,17,.12)!important;box-shadow:0 8px 20px rgba(7,22,17,.06)!important;font-size:18px!important;font-weight:950!important;
}

html body .pc-v7-login-single .login-back,
html body .pc-v7-login-single .login-header>a:last-child,
html body .pc-v7-login-single .login-top>a:last-child{min-width:54px!important;width:54px!important;padding:0!important}
html body .pc-v7-public-entry .entry-login svg{display:none!important}

@media(max-width:720px){
  html body .pc-v7-public-entry{padding-top:86px!important;scroll-padding-top:86px!important}
  html body .pc-v7-login-single{padding-top:102px!important;scroll-padding-top:102px!important;padding-bottom:calc(170px + env(safe-area-inset-bottom,0px))!important}
  html body .p7-register-page,
  html body .p7-contact-page,
  html body .p7-demo-page,
  html body .p7-docs-page,
  html body .p7-request-page{padding-top:88px!important;scroll-padding-top:88px!important}
  html body .pc-v7-public-entry .entry-header,
  html body .pc-v7-login-single .login-header,
  html body .pc-v7-login-single .login-top{height:72px!important;min-height:72px!important;max-height:72px!important;padding:10px 28px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}
  html body .pc-v7-public-entry .entry-brand,
  html body .pc-v7-login-single .login-brand{max-width:calc(100vw - 176px)!important;overflow:hidden!important}
  html body .pc-v7-public-entry .entry-brand-mark,
  html body .pc-v7-login-single .login-logo,
  html body .pc-v7-login-single .pc-global-brand-mark,
  html body .pc-v7-login-single .login-brand>span[aria-hidden]{width:56px!important;height:56px!important;min-width:56px!important;flex-basis:56px!important}
  html body .pc-v7-public-entry .entry-login{min-width:108px!important;height:54px!important}
  html body .p7-contact-page .p7-contact-nav a:not(:last-child),
  html body .p7-docs-page .p7-docs-nav a:not(:last-child){display:none!important}
}

@media(max-width:380px){
  html body .pc-v7-public-entry .entry-header,
  html body .pc-v7-login-single .login-header,
  html body .pc-v7-login-single .login-top{padding:9px 16px!important}
  html body .pc-v7-public-entry .entry-brand,
  html body .pc-v7-login-single .login-brand{max-width:calc(100vw - 150px)!important;gap:10px!important}
  html body .pc-v7-public-entry .entry-brand-mark,
  html body .pc-v7-login-single .login-logo,
  html body .pc-v7-login-single .pc-global-brand-mark{width:48px!important;height:48px!important;min-width:48px!important;flex-basis:48px!important}
  html body .pc-v7-public-entry .entry-login{min-width:94px!important;height:48px!important;padding:0 18px!important}
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
  let mark = link.querySelector<HTMLElement>('.pc-global-brand-mark, .login-logo');
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
      '.pc-v7-public-entry .entry-brand-mark, .pc-v7-login-single .login-logo, .p7-register-page .p7-register-brand-mark, .p7-contact-page .p7-contact-brand-mark, .p7-demo-page .p7-demo-brand>span[aria-hidden]:first-child, .p7-docs-page .p7-docs-brand>span:first-child, .p7-request-page .p7-request-brand>span:first-child, .pc-shell-root-v4 .pc-v4-brand>span[aria-hidden]:first-child, .pc-header-brand>span:first-child, .app-header-brand>span:first-child',
    )
    .forEach(lockIconLogo);

  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-login-single .login-header .login-brand, .pc-v7-login-single .login-top .login-brand, .pc-v7-login-single .login-header>a:first-of-type, .pc-v7-login-single .login-top>a:first-of-type').forEach(ensureLoginBrandLogo);
}

export function PublicBrandLogoFinal() {
  React.useEffect(() => {
    applyBrandLogo();
    const timers = [30, 80, 160, 360, 800, 1600, 3000].map((delay) => window.setTimeout(applyBrandLogo, delay));
    const observer = new MutationObserver(applyBrandLogo);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
