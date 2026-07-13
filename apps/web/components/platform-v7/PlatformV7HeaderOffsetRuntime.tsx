'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const HEADER_SELECTOR = [
  '.pc-site-header',
  '.pc-v4-header',
  '.pc-fixed-header',
  '[data-staff-platform-shell] > header',
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
  '[data-staff-platform-shell]',
  '.pc-shell-root-v4',
  '.pc-shell-root',
].join(',');

/**
 * Keeps content offset equal to the real fixed-header height.
 *
 * This is intentionally presentation-only. It does not read identity, roles,
 * permissions or business data. ResizeObserver covers translated copy, mobile
 * safe areas, text zoom and orientation changes without hard-coded route logic.
 */
export function PlatformV7HeaderOffsetRuntime() {
  const pathname = usePathname();

  React.useEffect(() => {
    let activeHeader: HTMLElement | null = null;
    let activeRoot: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frame = 0;

    const clearActiveBinding = () => {
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
      if (!nextHeader) return false;
      const nextRoot = nextHeader.closest(ROOT_SELECTOR) as HTMLElement | null;
      if (!nextRoot) return false;

      if (nextHeader === activeHeader && nextRoot === activeRoot) {
        updateOffset();
        return true;
      }

      clearActiveBinding();
      activeHeader = nextHeader;
      activeRoot = nextRoot;
      activeHeader.setAttribute('data-pc-fixed-header', 'true');

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(updateOffset);
        resizeObserver.observe(activeHeader);
      }

      updateOffset();
      return true;
    };

    const onViewportChange = () => bind();
    bind();

    mutationObserver = new MutationObserver(() => bind());
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver?.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      clearActiveBinding();
    };
  }, [pathname]);

  return null;
}
