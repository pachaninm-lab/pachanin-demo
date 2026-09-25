'use client';

import { useEffect } from 'react';

/** Restore the result anchor after GET navigation and browser history restoration. */
export function PublicMarketOffersAnchor() {
  useEffect(() => {
    let frame = 0;
    const restore = () => {
      if (window.location.hash !== '#offers') return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const target = document.getElementById('offers');
        if (!target) return;
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
      });
    };
    restore();
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', restore);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  return null;
}
