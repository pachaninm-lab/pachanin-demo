'use client';

import * as React from 'react';

const VIEWPORT_HEIGHT = '--gekta-visual-viewport-height';
const VIEWPORT_TOP = '--gekta-visual-viewport-top';
const COMPOSER_HEIGHT = '--gekta-composer-height';

/**
 * Mobile browser chrome and the on-screen keyboard do not reliably participate
 * in CSS viewport units. Keep a tiny runtime authority for the standalone
 * workspace so fixed/full-height UI follows the actually visible viewport and
 * the scroll-to-bottom affordance always clears the variable-height composer.
 */
export function GektaViewportAuthority() {
  React.useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let observedComposer: HTMLElement | null = null;
    let rootObserver: MutationObserver | null = null;

    const syncViewport = () => {
      const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      root.style.setProperty(VIEWPORT_HEIGHT, `${height}px`);
      root.style.setProperty(VIEWPORT_TOP, `${top}px`);
    };

    const syncComposer = () => {
      const composer = document.querySelector<HTMLElement>("[data-gekta-composer-root='true']");
      if (!composer) {
        root.style.removeProperty(COMPOSER_HEIGHT);
        return;
      }
      root.style.setProperty(COMPOSER_HEIGHT, `${Math.ceil(composer.getBoundingClientRect().height)}px`);
    };

    const composerObserver = new ResizeObserver(syncComposer);
    const bindComposer = () => {
      const composer = document.querySelector<HTMLElement>("[data-gekta-composer-root='true']");
      if (composer === observedComposer) {
        syncComposer();
        return;
      }
      composerObserver.disconnect();
      observedComposer = composer;
      if (composer) {
        composerObserver.observe(composer);
        rootObserver?.disconnect();
        rootObserver = null;
      }
      syncComposer();
    };

    syncViewport();
    bindComposer();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    if (!observedComposer) {
      rootObserver = new MutationObserver(bindComposer);
      const workspace = document.querySelector("[data-gekta-chat-workspace='true']");
      if (workspace) rootObserver.observe(workspace, { childList: true, subtree: true });
    }

    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      rootObserver?.disconnect();
      composerObserver.disconnect();
      root.style.removeProperty(VIEWPORT_HEIGHT);
      root.style.removeProperty(VIEWPORT_TOP);
      root.style.removeProperty(COMPOSER_HEIGHT);
    };
  }, []);

  return null;
}
