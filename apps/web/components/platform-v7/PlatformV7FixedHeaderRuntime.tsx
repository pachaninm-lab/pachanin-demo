'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const HEADER_SELECTOR = [
  '.pc-site-header',
  '.pc-v4-header',
  '.pc-fixed-header',
  '.p7-flow-header',
  '.p7-demo-clean > header',
  '.p7-docs-clean > header',
  '.p7-contact-header',
  '.open-header',
  '.p7-request-header',
].join(',');

const ROOT_SELECTOR = [
  '[data-public-supporting-shell]',
  'main',
  '.pc-shell-root-v4',
  '.pc-shell-root',
].join(',');

/** Presentation-only header measurement. It never reads role or authority data. */
export function PlatformV7FixedHeaderRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  React.useEffect(() => {
    let activeHeader: HTMLElement | null = null;
    let activeRoot: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frame = 0;

    const clearBinding = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (activeHeader) activeHeader.removeAttribute('data-pc-fixed-header');
      if (activeRoot) {
        activeRoot.removeAttribute('data-pc-has-fixed-header');
        activeRoot.style.removeProperty('--pc-local-fixed-header-height');
      }
      activeHeader = null;
      activeRoot = null;
    };

    const updateOffset = () => {
      if (!activeHeader || !activeRoot) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!activeHeader || !activeRoot) return;
        const height = Math.max(1, Math.ceil(activeHeader.getBoundingClientRect().height));
        activeRoot.style.setProperty('--pc-local-fixed-header-height', `${height}px`);
        activeRoot.setAttribute('data-pc-has-fixed-header', 'true');
      });
    };

    const bind = () => {
      const nextHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
      if (!nextHeader) return;
      const nextRoot = nextHeader.closest(ROOT_SELECTOR) as HTMLElement | null;
      if (!nextRoot) return;

      if (nextHeader !== activeHeader || nextRoot !== activeRoot) {
        clearBinding();
        activeHeader = nextHeader;
        activeRoot = nextRoot;
        activeHeader.setAttribute('data-pc-fixed-header', 'true');
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(updateOffset);
          resizeObserver.observe(activeHeader);
        }
      }
      updateOffset();
    };

    bind();
    mutationObserver = new MutationObserver(bind);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', bind, { passive: true });
    window.addEventListener('orientationchange', bind, { passive: true });
    window.visualViewport?.addEventListener('resize', bind, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver?.disconnect();
      window.removeEventListener('resize', bind);
      window.removeEventListener('orientationchange', bind);
      window.visualViewport?.removeEventListener('resize', bind);
      clearBinding();
    };
  }, [pathname]);

  return children;
}
