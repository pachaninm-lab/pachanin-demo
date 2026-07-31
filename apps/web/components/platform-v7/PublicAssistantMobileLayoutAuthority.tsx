'use client';

import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 720px)';
const PANEL_SELECTOR = '.pc-public-assistant-panel';
const BACKDROP_SELECTOR = '.pc-public-assistant-backdrop';
const MESSAGES_SELECTOR = '.pc-public-assistant-messages';
const COMPOSER_SELECTOR = '.pc-public-assistant-composer';
const FOOTER_SELECTOR = [
  '.pc-public-assistant-error',
  '.pc-public-assistant-reset-proxy',
  '.pc-public-assistant-composer',
].join(', ');

const PANEL_STYLE_PROPERTIES = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-height',
  'max-height',
  'padding-bottom',
  'box-sizing',
  'display',
  'flex-direction',
  'overflow',
  'background',
  'transform',
] as const;

const BACKDROP_STYLE_PROPERTIES = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-height',
  'max-height',
  'transform',
] as const;

const FOOTER_STYLE_PROPERTIES = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'margin',
  'z-index',
  'flex',
] as const;

const MESSAGE_STYLE_PROPERTIES = [
  'position',
  'flex',
  'min-height',
  'max-height',
  'overflow-x',
  'overflow-y',
  'background',
  'touch-action',
] as const;

const ROOT_LOCK_PROPERTIES = ['overflow', 'overscroll-behavior'] as const;
const BODY_LOCK_PROPERTIES = ['overflow', 'overscroll-behavior'] as const;

type StyleSnapshot = Map<string, { value: string; priority: string }>;
type ScrollLock = {
  x: number;
  y: number;
  root: StyleSnapshot;
  body: StyleSnapshot;
};

function snapshotProperties(node: HTMLElement, properties: readonly string[]): StyleSnapshot {
  return new Map(properties.map((property) => [property, {
    value: node.style.getPropertyValue(property),
    priority: node.style.getPropertyPriority(property),
  }]));
}

function restoreProperties(node: HTMLElement, snapshot: StyleSnapshot) {
  for (const [property, state] of snapshot) {
    if (state.value) node.style.setProperty(property, state.value, state.priority);
    else node.style.removeProperty(property);
  }
}

function removeProperties(node: HTMLElement, properties: readonly string[]) {
  for (const property of properties) node.style.removeProperty(property);
}

function setImportant(node: HTMLElement, property: string, value: string) {
  node.style.setProperty(property, value, 'important');
}

function clearMobileAuthority(panel: HTMLElement) {
  delete panel.dataset.pcMobileViewportAuthority;
  delete panel.dataset.pcMobileViewportHeight;
  removeProperties(panel, PANEL_STYLE_PROPERTIES);

  const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
  if (messages) removeProperties(messages, MESSAGE_STYLE_PROPERTIES);

  for (const node of panel.querySelectorAll<HTMLElement>(FOOTER_SELECTOR)) {
    removeProperties(node, FOOTER_STYLE_PROPERTIES);
  }
}

function isInsideMessages(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(MESSAGES_SELECTOR));
}

export function PublicAssistantMobileLayoutAuthority() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.visualViewport;
    const media = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    let settleFrame = 0;
    let pollTimer = 0;
    let missingPanelFrames = 0;
    let scrollLock: ScrollLock | null = null;
    let observedPanel: HTMLElement | null = null;
    const resizeObserver = new ResizeObserver(() => schedule());

    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        // WebKit can expose stale viewport values in the first animation frame
        // after keyboard focus/resize. The second frame is the earliest stable
        // point documented by real iOS reproductions.
        settleFrame = window.requestAnimationFrame(() => {
          settleFrame = 0;
          layout();
        });
      });
    };

    const stopPolling = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = 0;
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = window.setInterval(schedule, 160);
    };

    const lockPage = () => {
      if (scrollLock) return;
      scrollLock = {
        x: window.scrollX,
        y: window.scrollY,
        root: snapshotProperties(root, ROOT_LOCK_PROPERTIES),
        body: snapshotProperties(body, BODY_LOCK_PROPERTIES),
      };

      root.dataset.pcPublicAssistantScrollLock = 'true';
      setImportant(root, 'overflow', 'hidden');
      setImportant(root, 'overscroll-behavior', 'none');
      setImportant(body, 'overflow', 'hidden');
      setImportant(body, 'overscroll-behavior', 'none');
    };

    const unlockPage = () => {
      if (!scrollLock) return;
      const locked = scrollLock;
      scrollLock = null;
      delete root.dataset.pcPublicAssistantScrollLock;
      restoreProperties(root, locked.root);
      restoreProperties(body, locked.body);
      window.requestAnimationFrame(() => window.scrollTo(locked.x, locked.y));
    };

    const preventBackgroundTouch = (event: TouchEvent) => {
      if (!scrollLock || isInsideMessages(event.target)) return;
      event.preventDefault();
    };

    const preventBackgroundWheel = (event: WheelEvent) => {
      if (!scrollLock || isInsideMessages(event.target)) return;
      event.preventDefault();
    };

    const observePanel = (panel: HTMLElement | null) => {
      if (panel === observedPanel) return;
      resizeObserver.disconnect();
      observedPanel = panel;
      if (!panel) return;
      resizeObserver.observe(panel);
      for (const node of panel.querySelectorAll<HTMLElement>(
        '.pc-public-assistant-header, .pc-public-assistant-messages, .pc-public-assistant-error, .pc-public-assistant-reset-proxy, .pc-public-assistant-composer',
      )) {
        resizeObserver.observe(node);
      }
    };

    const layout = () => {
      const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
      observePanel(panel);

      if (!panel || !media.matches) {
        if (!panel && media.matches && scrollLock && missingPanelFrames < 2) {
          missingPanelFrames += 1;
          schedule();
          return;
        }
        missingPanelFrames = 0;
        stopPolling();
        if (panel) clearMobileAuthority(panel);
        const backdrop = document.querySelector<HTMLElement>(BACKDROP_SELECTOR);
        if (backdrop) {
          delete backdrop.dataset.pcMobileViewportAuthority;
          removeProperties(backdrop, BACKDROP_STYLE_PROPERTIES);
        }
        unlockPage();
        return;
      }

      missingPanelFrames = 0;
      const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
      const composer = panel.querySelector<HTMLElement>(COMPOSER_SELECTOR);
      if (!messages || !composer) return;

      lockPage();
      startPolling();

      const referenceScrollY = scrollLock?.y ?? window.scrollY;
      const visualOffsetTop = Math.max(0, viewport?.offsetTop ?? 0);
      const pageRelativeTop = Math.max(0, (viewport?.pageTop ?? referenceScrollY) - referenceScrollY);
      const visualTop = Math.round(Math.max(visualOffsetTop, pageRelativeTop));
      const visualLeft = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
      const visualHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const visualWidth = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));

      panel.dataset.pcMobileViewportAuthority = 'true';
      panel.dataset.pcMobileViewportHeight = String(visualHeight);
      setImportant(panel, 'position', 'fixed');
      setImportant(panel, 'top', `${visualTop}px`);
      setImportant(panel, 'right', 'auto');
      setImportant(panel, 'bottom', 'auto');
      setImportant(panel, 'left', `${visualLeft}px`);
      setImportant(panel, 'width', `${visualWidth}px`);
      setImportant(panel, 'height', `${visualHeight}px`);
      setImportant(panel, 'min-height', '0');
      setImportant(panel, 'max-height', `${visualHeight}px`);
      setImportant(panel, 'padding-bottom', '0');
      setImportant(panel, 'box-sizing', 'border-box');
      setImportant(panel, 'display', 'flex');
      setImportant(panel, 'flex-direction', 'column');
      setImportant(panel, 'overflow', 'hidden');
      setImportant(panel, 'background', '#ffffff');
      setImportant(panel, 'transform', 'none');

      setImportant(messages, 'position', 'relative');
      setImportant(messages, 'flex', '1 1 auto');
      setImportant(messages, 'min-height', '0');
      setImportant(messages, 'max-height', 'none');
      setImportant(messages, 'overflow-x', 'hidden');
      setImportant(messages, 'overflow-y', 'auto');
      setImportant(messages, 'background', '#ffffff');
      setImportant(messages, 'touch-action', 'pan-y');

      for (const node of panel.querySelectorAll<HTMLElement>(FOOTER_SELECTOR)) {
        setImportant(node, 'position', 'relative');
        setImportant(node, 'top', 'auto');
        setImportant(node, 'right', 'auto');
        setImportant(node, 'bottom', 'auto');
        setImportant(node, 'left', 'auto');
        setImportant(node, 'width', 'auto');
        setImportant(node, 'height', 'auto');
        setImportant(node, 'margin', '0');
        setImportant(node, 'z-index', '5');
        setImportant(node, 'flex', '0 0 auto');
      }

      const backdrop = document.querySelector<HTMLElement>(BACKDROP_SELECTOR);
      if (backdrop) {
        backdrop.dataset.pcMobileViewportAuthority = 'true';
        setImportant(backdrop, 'position', 'fixed');
        setImportant(backdrop, 'top', `${visualTop}px`);
        setImportant(backdrop, 'right', 'auto');
        setImportant(backdrop, 'bottom', 'auto');
        setImportant(backdrop, 'left', `${visualLeft}px`);
        setImportant(backdrop, 'width', `${visualWidth}px`);
        setImportant(backdrop, 'height', `${visualHeight}px`);
        setImportant(backdrop, 'min-height', '0');
        setImportant(backdrop, 'max-height', `${visualHeight}px`);
        setImportant(backdrop, 'transform', 'none');
      }
    };

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    viewport?.addEventListener('scrollend', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('touchmove', preventBackgroundTouch, { passive: false });
    document.addEventListener('wheel', preventBackgroundWheel, { passive: false });
    media.addEventListener?.('change', schedule);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      stopPolling();
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      viewport?.removeEventListener('scrollend', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('touchmove', preventBackgroundTouch);
      document.removeEventListener('wheel', preventBackgroundWheel);
      media.removeEventListener?.('change', schedule);
      if (observedPanel) clearMobileAuthority(observedPanel);
      const backdrop = document.querySelector<HTMLElement>(BACKDROP_SELECTOR);
      if (backdrop) {
        delete backdrop.dataset.pcMobileViewportAuthority;
        removeProperties(backdrop, BACKDROP_STYLE_PROPERTIES);
      }
      unlockPage();
    };
  }, []);

  return null;
}
