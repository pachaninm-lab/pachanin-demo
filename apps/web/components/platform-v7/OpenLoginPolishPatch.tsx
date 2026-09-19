'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

export function OpenLoginPolishPatch() {
  const pathname = usePathname();
  const enabled = pathname === '/platform-v7/open' || pathname === '/platform-v7/login';

  React.useEffect(() => {
    if (!enabled) return;
    const clean = () => {
      const root = document.querySelector<HTMLElement>('.pc-clean-login');
      if (!root) return;
      root.querySelectorAll<HTMLElement>('.recover-note, .forgot-access-panel').forEach((item) => item.remove());
    };
    const raf = window.requestAnimationFrame(clean);
    const timers = [120, 480].map((delay) => window.setTimeout(clean, delay));
    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled]);

  return null;
}
