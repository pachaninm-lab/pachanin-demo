'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const HEADER_SELECTOR = [
  '.pc-site-header',
  '.pc-v4-header',
  '.pc-shell-root-v4 > header',
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

/** Presentation-only shell measurement. It never reads role or authority data. */
export function PlatformV7FixedHeaderRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  React.useEffect(() => {
    let activeHeader: HTMLElement | null = null;
    let activeRoot: HTMLElement | null = null;
    let activeActions: HTMLElement | null = null;
    let addedActionsClass = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frame = 0;

    const clearHeaderBinding = () => {
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

    const clearActionsBinding = () => {
      if (activeActions && addedActionsClass) activeActions.classList.remove('pc-v4-actions');
      activeActions = null;
      addedActionsClass = false;
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

    const bindActions = () => {
      const searchButton = document.querySelector<HTMLElement>(".pc-shell-root-v4 button[aria-label='Открыть поиск']");
      const nextActions = searchButton?.parentElement ?? null;
      if (nextActions === activeActions) return;

      clearActionsBinding();
      if (!nextActions) return;
      activeActions = nextActions;
      addedActionsClass = !activeActions.classList.contains('pc-v4-actions');
      activeActions.classList.add('pc-v4-actions');
    };

    const bindHeader = () => {
      const nextHeader = document.querySelector<HTMLElement>(HEADER_SELECTOR);
      if (!nextHeader) return;
      const nextRoot = nextHeader.closest(ROOT_SELECTOR) as HTMLElement | null;
      if (!nextRoot) return;

      if (nextHeader !== activeHeader || nextRoot !== activeRoot) {
        clearHeaderBinding();
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

    const bind = () => {
      bindActions();
      bindHeader();
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
      clearActionsBinding();
      clearHeaderBinding();
    };
  }, [pathname]);

  return children;
}
