'use client';

import * as React from 'react';

const VIEWPORT_HEIGHT = '--gekta-visual-viewport-height';
const VIEWPORT_TOP = '--gekta-visual-viewport-top';
const KEYBOARD_INSET = '--gekta-keyboard-inset';
const COMPOSER_HEIGHT = '--gekta-composer-height';
const KEYBOARD_THRESHOLD_PX = 48;
const MAX_KEYBOARD_INSET_PX = 720;

const SCROLL_TO_LATEST_LABEL = {
  ru: 'К последнему сообщению',
  en: 'Go to the latest message',
  zh: '前往最新消息',
} as const;

function currentLocale(): keyof typeof SCROLL_TO_LATEST_LABEL {
  const language = document.documentElement.lang.toLowerCase();
  if (language.startsWith('zh') || window.location.pathname.startsWith('/gekta/zh')) return 'zh';
  if (language.startsWith('en') || window.location.pathname.startsWith('/gekta/en')) return 'en';
  return 'ru';
}

function isTextEntry(node: Element | null): boolean {
  return node instanceof HTMLTextAreaElement
    || (node instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit'].includes(node.type))
    || (node instanceof HTMLElement && node.isContentEditable);
}

/**
 * Mobile browser chrome and the on-screen keyboard do not reliably participate
 * in CSS viewport units. This runtime authority follows the actually visible
 * viewport, batches resize/scroll work into animation frames and measures the
 * composer. It deliberately does not lock html/body scrolling: modal surfaces
 * own their own lock, while keyboard ownership stays local to the Gekta shell.
 */
export function GektaViewportAuthority() {
  React.useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let observedComposer: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let lastViewportWidth = 0;
    let layoutBaselineHeight = 0;
    let textEntryEngaged = isTextEntry(document.activeElement);

    const composerObserver = new ResizeObserver(() => {
      const composer = observedComposer;
      if (!composer) return;
      root.style.setProperty(COMPOSER_HEIGHT, `${Math.ceil(composer.getBoundingClientRect().height)}px`);
    });

    const bindComposer = () => {
      const composer = document.querySelector<HTMLElement>("[data-gekta-composer-root='true']");
      if (composer === observedComposer) return;
      composerObserver.disconnect();
      observedComposer = composer;
      if (composer) {
        composerObserver.observe(composer);
        root.style.setProperty(COMPOSER_HEIGHT, `${Math.ceil(composer.getBoundingClientRect().height)}px`);
      } else {
        root.style.removeProperty(COMPOSER_HEIGHT);
      }
    };

    const syncRuntimeSurfaces = (keyboardOpen: boolean) => {
      const privacy = document.getElementById('gekta-composer-boundary');
      if (privacy) privacy.hidden = keyboardOpen;

      const jump = document.querySelector<HTMLElement>("[data-gekta-scroll-to-bottom='true'], button[aria-label='Scroll to bottom']");
      if (jump) {
        const label = SCROLL_TO_LATEST_LABEL[currentLocale()];
        jump.dataset.gektaScrollToBottom = 'true';
        jump.setAttribute('aria-label', label);
        jump.setAttribute('title', label);
      }
    };

    const syncViewport = () => {
      frame = 0;
      bindComposer();

      const visibleHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const visibleTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const viewportWidth = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
      const layoutHeight = Math.max(
        1,
        Math.round(document.documentElement.clientHeight),
        Math.round(window.innerHeight),
        visibleHeight + visibleTop,
      );

      if (!lastViewportWidth || Math.abs(viewportWidth - lastViewportWidth) > 80) {
        layoutBaselineHeight = layoutHeight;
      } else {
        layoutBaselineHeight = Math.max(layoutBaselineHeight, layoutHeight);
      }
      lastViewportWidth = viewportWidth;

      const rawInset = layoutBaselineHeight - visibleHeight - visibleTop;
      const maxInset = Math.min(MAX_KEYBOARD_INSET_PX, Math.round(layoutBaselineHeight * 0.75));
      const activeTextEntry = isTextEntry(document.activeElement);
      if (activeTextEntry) textEntryEngaged = true;
      const keyboardInset = textEntryEngaged
        ? Math.max(0, Math.min(maxInset, Math.round(rawInset)))
        : 0;
      const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD_PX;
      if (!keyboardOpen && !activeTextEntry) textEntryEngaged = false;

      root.style.setProperty(VIEWPORT_HEIGHT, `${visibleHeight}px`);
      root.style.setProperty(VIEWPORT_TOP, `${visibleTop}px`);
      root.style.setProperty(KEYBOARD_INSET, `${keyboardInset}px`);
      if (keyboardOpen) root.dataset.gektaKeyboardOpen = 'true';
      else delete root.dataset.gektaKeyboardOpen;

      syncRuntimeSurfaces(keyboardOpen);
    };

    const scheduleViewportSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncViewport);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isTextEntry(event.target instanceof Element ? event.target : null)) textEntryEngaged = true;
      scheduleViewportSync();
    };

    scheduleViewportSync();
    viewport?.addEventListener('resize', scheduleViewportSync);
    viewport?.addEventListener('scroll', scheduleViewportSync);
    window.addEventListener('resize', scheduleViewportSync);
    window.addEventListener('orientationchange', scheduleViewportSync);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', scheduleViewportSync);

    observer = new MutationObserver(scheduleViewportSync);
    const workspace = document.querySelector("[data-gekta-chat-workspace='true']");
    observer.observe(workspace ?? document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-gekta-chat-active'],
      childList: true,
      subtree: true,
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', scheduleViewportSync);
      viewport?.removeEventListener('scroll', scheduleViewportSync);
      window.removeEventListener('resize', scheduleViewportSync);
      window.removeEventListener('orientationchange', scheduleViewportSync);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', scheduleViewportSync);
      observer?.disconnect();
      composerObserver.disconnect();
      root.style.removeProperty(VIEWPORT_HEIGHT);
      root.style.removeProperty(VIEWPORT_TOP);
      root.style.removeProperty(KEYBOARD_INSET);
      root.style.removeProperty(COMPOSER_HEIGHT);
      delete root.dataset.gektaKeyboardOpen;
      const privacy = document.getElementById('gekta-composer-boundary');
      if (privacy) privacy.hidden = false;
    };
  }, []);

  return null;
}
