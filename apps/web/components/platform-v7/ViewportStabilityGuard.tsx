'use client';

import { useEffect } from 'react';

function clampViewport() {
  const root = document.querySelector<HTMLElement>('.pc-shell-root-v4');
  if (!root) return;

  const width = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  root.style.setProperty('--pc-visual-width', `${width}px`);
  root.style.setProperty('--pc-visual-height', `${height}px`);

  document.documentElement.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  root.style.maxWidth = '100vw';
  root.style.overflowX = 'clip';

  const main = root.querySelector<HTMLElement>('.pc-v4-main');
  if (main) {
    main.style.maxWidth = '100%';
    main.style.overflowX = 'clip';
  }
}

export function ViewportStabilityGuard() {
  useEffect(() => {
    clampViewport();
    window.addEventListener('resize', clampViewport);
    window.addEventListener('orientationchange', clampViewport);
    window.visualViewport?.addEventListener('resize', clampViewport);
    window.visualViewport?.addEventListener('scroll', clampViewport);
    const timers = [80, 240, 600].map((delay) => window.setTimeout(clampViewport, delay));

    return () => {
      window.removeEventListener('resize', clampViewport);
      window.removeEventListener('orientationchange', clampViewport);
      window.visualViewport?.removeEventListener('resize', clampViewport);
      window.visualViewport?.removeEventListener('scroll', clampViewport);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
