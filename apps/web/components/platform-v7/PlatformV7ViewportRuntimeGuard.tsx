'use client';

import { useEffect } from 'react';

function syncViewport() {
  const viewport = window.visualViewport;
  const width = Math.max(320, Math.floor(viewport?.width ?? window.innerWidth));
  const height = Math.max(320, Math.floor(viewport?.height ?? window.innerHeight));
  const keyboardOpen = height < Math.floor(window.innerHeight * 0.78);
  const root = document.documentElement;
  root.style.setProperty('--p7-real-vw', `${width}px`);
  root.style.setProperty('--p7-real-vh', `${height}px`);
  root.classList.toggle('p7-keyboard-open', keyboardOpen);
  if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
  root.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

export function PlatformV7ViewportRuntimeGuard() {
  useEffect(() => {
    syncViewport();
    const schedule = () => window.requestAnimationFrame(syncViewport);
    const interval = window.setInterval(syncViewport, 1400);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, []);

  return <style>{css}</style>;
}

const css = `.p7-keyboard-open .pc-shell-root-v4 .pc-v4-bottomnav{display:none!important}.p7-keyboard-open .p7-support-chat-button{display:none!important}.p7-keyboard-open .pc-shell-root-v4 .pc-v4-main{padding-bottom:24px!important}.pc-shell-root-v4,.pc-v7-public-entry,.pc-v7-login-single,.p7-contact-page,.p7-demo-clean{max-width:var(--p7-real-vw,100%)!important}`;
