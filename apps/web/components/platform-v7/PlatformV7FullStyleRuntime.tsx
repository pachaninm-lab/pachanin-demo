'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';
import '@/styles/mobile-polish.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-shell-clarity.css';
import '@/styles/platform-v7-work-surfaces.css';
import '@/styles/platform-v7-mobile-excellence.css';
import '@/styles/platform-v7-premium-visual-polish.css';
import '@/styles/platform-v7-final-polish.css';
import '@/styles/platform-v7-living-deal.css';
import '@/styles/platform-v7-premium-cockpit.css';
import '@/styles/platform-v7-entry-fix.css';
import '@/styles/platform-v7-mobile-hardening.css';
import '@/styles/platform-v7-mobile-reflow-p0.css';
import '@/styles/platform-v7-shell-restore.css';
import '@/styles/platform-v7-register-header-override.css';
import '@/styles/platform-v7-mobile-screenshot-fixes.css';
import '@/styles/platform-v7-mobile-shell-p1.css';
import '@/styles/platform-v7-shell-critical.css';
import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-landing.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-seller-mobile-usability.css';
import '@/styles/platform-v7-mobile-bottom-tools.css';
import '@/styles/platform-v7-seller-workspace-v2.css';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-protected-grid-stable.css';
import '@/styles/platform-v7-control-tower-mobile.css';
import '@/styles/platform-v7-bank-mobile.css';
import '@/styles/platform-v7-elevator-mobile.css';
import '@/styles/platform-v7-lab-mobile.css';
import '@/styles/platform-v7-compliance-mobile.css';
import '@/styles/platform-v7-arbitrator-mobile.css';
import '@/styles/platform-v7-executive-mobile.css';
import '@/styles/platform-v7-clean-deal-mobile.css';
import '@/styles/platform-v7-offer-to-deal-mobile.css';
import '@/styles/platform-v7-stable-shell.css';
import '@/styles/platform-v7-viewport-stability.css';
import '@/styles/platform-v7-adaptive-devices.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import '@/styles/platform-v7-support-chat-polish.css';
import '@/styles/platform-v7-final-viewport-cleanup.css';
import '@/styles/platform-v7-public-hero-watermark.css';
import '@/styles/platform-v7-contextual-wheat-backgrounds.css';

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
export function PlatformV7FullStyleRuntime({ children }: { children: ReactNode }) {
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
