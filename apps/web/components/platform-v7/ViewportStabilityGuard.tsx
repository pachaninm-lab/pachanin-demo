'use client';

import { useEffect } from 'react';

function clampViewport() {
  const root = document.querySelector<HTMLElement>('.pc-shell-root-v4');
  const publicEntry = document.querySelector<HTMLElement>('.pc-v7-public-entry');
  const contactPage = document.querySelector<HTMLElement>('.p7-contact-page');
  const width = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.floor(window.visualViewport?.height ?? window.innerHeight);

  document.documentElement.style.setProperty('--pc-visual-width', `${width}px`);
  document.documentElement.style.setProperty('--pc-visual-height', `${height}px`);
  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100dvw';
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100dvw';
  document.body.style.overflowX = 'hidden';

  if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  if (root) {
    root.style.setProperty('--pc-visual-width', `${width}px`);
    root.style.setProperty('--pc-visual-height', `${height}px`);
    root.style.maxWidth = '100dvw';
    root.style.overflowX = 'clip';

    const main = root.querySelector<HTMLElement>('.pc-v4-main');
    if (main) {
      main.style.maxWidth = '100%';
      main.style.overflowX = 'clip';
      main.scrollLeft = 0;
    }
  }

  [publicEntry, contactPage].forEach((node) => {
    if (!node) return;
    node.style.width = '100%';
    node.style.maxWidth = '100dvw';
    node.style.overflowX = 'hidden';
    node.scrollLeft = 0;
  });
}

export function ViewportStabilityGuard() {
  useEffect(() => {
    clampViewport();
    window.addEventListener('resize', clampViewport);
    window.addEventListener('orientationchange', clampViewport);
    window.addEventListener('scroll', clampViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', clampViewport);
    window.visualViewport?.addEventListener('scroll', clampViewport);
    const timers = [40, 80, 160, 320, 600, 1200, 2400].map((delay) => window.setTimeout(clampViewport, delay));

    return () => {
      window.removeEventListener('resize', clampViewport);
      window.removeEventListener('orientationchange', clampViewport);
      window.removeEventListener('scroll', clampViewport);
      window.visualViewport?.removeEventListener('resize', clampViewport);
      window.visualViewport?.removeEventListener('scroll', clampViewport);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
