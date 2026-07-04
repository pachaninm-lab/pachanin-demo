'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

function clampViewport() {
  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100vw';
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100vw';
  document.body.style.overflowX = 'hidden';
  if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  document.querySelectorAll<HTMLElement>('.pc-v7-public-entry,.p7-contact-page,.pc-shell-root-v4,.pc-v4-main').forEach((node) => {
    node.style.maxWidth = '100vw';
    node.style.overflowX = 'hidden';
    node.scrollLeft = 0;
  });
}

const css = `
html,body{width:100%!important;max-width:100vw!important;overflow-x:hidden!important;overscroll-behavior-x:none!important}.pc-v7-public-entry,.p7-contact-page,.pc-shell-root-v4,.pc-v4-main{max-width:100vw!important;overflow-x:hidden!important}.pc-v7-public-entry .entry-brand-mark{display:inline-block!important;width:42px!important;height:42px!important;min-width:42px!important;border-radius:0!important;background-color:transparent!important;background-image:url('${BRAND_LOGO_DATA_URI}')!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;color:transparent!important;box-shadow:none!important}.pc-v7-public-entry .entry-brand-mark svg{display:none!important}.p7-support-chat-panel{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(390px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;overflow:hidden!important}.p7-support-chat-panel *{box-sizing:border-box!important;min-width:0!important;max-width:100%!important}.p7-support-chat-form,.p7-support-chat-success{overflow-x:hidden!important}@media(max-width:720px){.pc-v7-public-entry{padding-bottom:calc(170px + env(safe-area-inset-bottom,0px))!important}.pc-v7-public-entry .entry-header{width:100vw!important;max-width:100vw!important;left:0!important;right:0!important;overflow:hidden!important}.pc-v7-public-entry .entry-brand{max-width:calc(100vw - 122px)!important;overflow:hidden!important}.pc-v7-public-entry .entry-brand strong{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.pc-v7-public-entry .entry-login{min-width:88px!important;max-width:96px!important;padding:0 12px!important;white-space:nowrap!important}.pc-v7-public-entry .entry-hero{width:100%!important;max-width:100%!important;margin:0!important;padding-left:10px!important;padding-right:10px!important;overflow:hidden!important}.pc-v7-public-entry .entry-hero-copy{width:100%!important;max-width:100%!important;padding:20px 16px!important;overflow:hidden!important}.pc-v7-public-entry .entry-kicker{width:100%!important;max-width:100%!important;white-space:normal!important;text-align:center!important;justify-content:center!important}.pc-v7-public-entry .entry-hero h1{font-size:clamp(32px,8.7vw,38px)!important;line-height:1.04!important;letter-spacing:-.055em!important;text-wrap:balance!important}.pc-v7-public-entry .entry-hero p{font-size:clamp(15px,4.1vw,17px)!important;line-height:1.43!important}.pc-v7-public-entry .entry-hero-actions{display:grid!important;grid-template-columns:1fr!important;width:100%!important}.pc-v7-public-entry .entry-primary-cta,.pc-v7-public-entry .entry-secondary-cta,.pc-v7-public-entry .entry-register-cta{width:100%!important;max-width:100%!important;min-width:0!important;white-space:normal!important;text-align:center!important}.p7-support-chat-button{right:max(14px,env(safe-area-inset-right,0px))!important;bottom:calc(env(safe-area-inset-bottom,0px) + 118px)!important}.p7-support-chat-panel{left:50%!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 184px)!important;transform:translateX(-50%)!important;width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 236px)!important}.p7-support-chat-panel:focus-within{bottom:calc(env(safe-area-inset-bottom,0px) + 12px)!important;max-height:calc(100dvh - 28px)!important}}
`;

export function PlatformV7MobileFinalGuard() {
  React.useEffect(() => {
    clampViewport();
    const timers = [40, 120, 260, 600, 1200, 2400].map((delay) => window.setTimeout(clampViewport, delay));
    window.addEventListener('resize', clampViewport);
    window.addEventListener('orientationchange', clampViewport);
    window.visualViewport?.addEventListener('resize', clampViewport);
    window.visualViewport?.addEventListener('scroll', clampViewport);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', clampViewport);
      window.removeEventListener('orientationchange', clampViewport);
      window.visualViewport?.removeEventListener('resize', clampViewport);
      window.visualViewport?.removeEventListener('scroll', clampViewport);
    };
  }, []);
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
