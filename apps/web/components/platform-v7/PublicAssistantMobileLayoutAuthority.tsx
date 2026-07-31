'use client';

import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 720px)';
const PANEL_SELECTOR = '.pc-public-assistant-panel';
const BACKDROP_SELECTOR = '.pc-public-assistant-backdrop';
const MESSAGES_SELECTOR = '.pc-public-assistant-messages';
const COMPOSER_SELECTOR = '.pc-public-assistant-composer';
const KEYBOARD_DELTA_PX = 120;
const FOCUS_SETTLE_GRACE_MS = 800;
const DOWNWARD_GUARD_PX = 24;
const DOWNWARD_SAMPLE_EPSILON_PX = 10;
const DOWNWARD_CONFIRMATION_COUNT = 6;

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
  '--pc-ai-visible-top',
  '--pc-ai-visible-height',
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
] as const;

const ROOT_LOCK_PROPERTIES = [
  'overflow',
  'overscroll-behavior',
] as const;

const BODY_LOCK_PROPERTIES = [
  'overflow',
  'overscroll-behavior',
] as const;

const ROOT_VIEWPORT_PROPERTIES = [
  '--pc-visual-viewport-height',
  '--pc-visual-viewport-top',
  '--pc-visual-viewport-bottom',
] as const;

type StyleSnapshot = Map<string, { value: string; priority: string }>;
type ScrollLock = {
  x: number;
  y: number;
  root: StyleSnapshot;
  body: StyleSnapshot;
};

type VirtualKeyboardLike = EventTarget & {
  boundingRect?: DOMRectReadOnly;
};

type NavigatorWithVirtualKeyboard = Navigator & {
  virtualKeyboard?: VirtualKeyboardLike;
};

type ViewportMetrics = {
  visualTop: number;
  visualLeft: number;
  visualWidth: number;
  visualHeight: number;
  visualBottom: number;
  innerHeight: number;
  clientHeight: number;
  keyboardHeight: number;
};

type BaselineMetrics = {
  visualTop: number;
  visualHeight: number;
  innerHeight: number;
  clientHeight: number;
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
  delete panel.dataset.pcKeyboardFocus;
  delete panel.dataset.pcKeyboardViewport;
  delete panel.dataset.pcKeyboardGeometry;
  removeProperties(panel, PANEL_STYLE_PROPERTIES);

  const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
  if (messages) removeProperties(messages, MESSAGE_STYLE_PROPERTIES);

  for (const node of panel.querySelectorAll<HTMLElement>(FOOTER_SELECTOR)) {
    removeProperties(node, FOOTER_STYLE_PROPERTIES);
  }
}

function isComposerFocused(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLTextAreaElement
    && Boolean(active.closest(COMPOSER_SELECTOR));
}

export function PublicAssistantMobileLayoutAuthority() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.visualViewport;
    const virtualKeyboard = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
    const media = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    let pollTimer = 0;
    let scrollLock: ScrollLock | null = null;
    let observedPanel: HTMLElement | null = null;
    let focusedLastFrame = false;
    let focusStartedAt = 0;
    let stableVisibleBottom: number | null = null;
    let pendingDownwardBottom: number | null = null;
    let pendingDownwardCount = 0;

    const initialVisualTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
    let baseline: BaselineMetrics = {
      visualTop: initialVisualTop,
      visualHeight: Math.max(1, Math.round(viewport?.height ?? window.innerHeight)),
      innerHeight: Math.max(1, Math.round(window.innerHeight)),
      clientHeight: Math.max(1, Math.round(root.clientHeight || window.innerHeight)),
    };

    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(layout);
    };

    const resizeObserver = new ResizeObserver(schedule);

    const stopPolling = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = 0;
    };

    const startPolling = () => {
      if (pollTimer) return;
      // WebKit shells may update keyboard geometry without a final resize event.
      // Poll only while the assistant is visible and stop immediately on close.
      pollTimer = window.setInterval(schedule, 120);
    };

    const resetFocusedGeometry = () => {
      focusedLastFrame = false;
      focusStartedAt = 0;
      stableVisibleBottom = null;
      pendingDownwardBottom = null;
      pendingDownwardCount = 0;
    };

    const clearRootViewport = () => {
      removeProperties(root, ROOT_VIEWPORT_PROPERTIES);
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
      if (window.scrollX !== locked.x || window.scrollY !== locked.y) {
        window.requestAnimationFrame(() => window.scrollTo(locked.x, locked.y));
      }
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

    const readMetrics = (): ViewportMetrics => {
      const visualTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const visualHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      return {
        visualTop,
        visualLeft: Math.max(0, Math.round(viewport?.offsetLeft ?? 0)),
        visualWidth: Math.max(1, Math.round(viewport?.width ?? window.innerWidth)),
        visualHeight,
        visualBottom: visualTop + visualHeight,
        innerHeight: Math.max(1, Math.round(window.innerHeight)),
        clientHeight: Math.max(1, Math.round(root.clientHeight || window.innerHeight)),
        keyboardHeight: Math.max(0, Math.round(virtualKeyboard?.boundingRect?.height ?? 0)),
      };
    };

    const updateBaseline = (metrics: ViewportMetrics) => {
      baseline = {
        visualTop: metrics.visualTop,
        visualHeight: metrics.visualHeight,
        innerHeight: metrics.innerHeight,
        clientHeight: metrics.clientHeight,
      };
    };

    const reconcileVisibleBottom = (
      metrics: ViewportMetrics,
      focused: boolean,
    ): { visibleBottom: number; geometry: string } => {
      if (!focused) {
        resetFocusedGeometry();
        return { visibleBottom: metrics.visualBottom, geometry: 'visual-viewport' };
      }

      if (!focusedLastFrame) {
        focusedLastFrame = true;
        focusStartedAt = Date.now();
        stableVisibleBottom = null;
        pendingDownwardBottom = null;
        pendingDownwardCount = 0;
      }

      const baselineVisualBottom = baseline.visualTop + baseline.visualHeight;
      const baselineLayoutBottom = Math.max(
        baselineVisualBottom,
        baseline.innerHeight,
        baseline.clientHeight,
      );
      const innerBottom = Math.max(metrics.visualTop + 1, metrics.innerHeight);
      const clientBottom = Math.max(metrics.visualTop + 1, metrics.clientHeight);
      const candidates: Array<{ bottom: number; source: string }> = [];

      if (baselineVisualBottom - metrics.visualBottom >= KEYBOARD_DELTA_PX) {
        candidates.push({ bottom: metrics.visualBottom, source: 'visual-viewport' });
      }
      if (baseline.innerHeight - metrics.innerHeight >= KEYBOARD_DELTA_PX) {
        candidates.push({ bottom: innerBottom, source: 'window-inner-height' });
      }
      if (baseline.clientHeight - metrics.clientHeight >= KEYBOARD_DELTA_PX) {
        candidates.push({ bottom: clientBottom, source: 'document-client-height' });
      }

      let candidate = candidates.length
        ? Math.max(...candidates.map(({ bottom }) => bottom))
        : metrics.visualBottom;
      let geometry = candidates.length
        ? candidates.map(({ source }) => source).join('+')
        : 'visual-viewport';

      if (metrics.keyboardHeight > 0) {
        const keyboardTopFromHeight = Math.max(
          metrics.visualTop + 1,
          baselineLayoutBottom - metrics.keyboardHeight,
        );
        candidate = Math.min(candidate, keyboardTopFromHeight);
        geometry = `${geometry}+keyboard-height`;
      }

      candidate = Math.max(
        metrics.visualTop + 1,
        Math.min(candidate, baselineLayoutBottom),
      );

      const withinOpeningAnimation = Date.now() - focusStartedAt <= FOCUS_SETTLE_GRACE_MS;
      if (stableVisibleBottom === null || withinOpeningAnimation) {
        stableVisibleBottom = candidate;
        pendingDownwardBottom = null;
        pendingDownwardCount = 0;
      } else if (candidate >= stableVisibleBottom - DOWNWARD_GUARD_PX) {
        stableVisibleBottom = candidate;
        pendingDownwardBottom = null;
        pendingDownwardCount = 0;
      } else {
        const sameDownwardSample = pendingDownwardBottom !== null
          && Math.abs(pendingDownwardBottom - candidate) <= DOWNWARD_SAMPLE_EPSILON_PX;
        pendingDownwardBottom = candidate;
        pendingDownwardCount = sameDownwardSample ? pendingDownwardCount + 1 : 1;

        if (pendingDownwardCount >= DOWNWARD_CONFIRMATION_COUNT) {
          stableVisibleBottom = candidate;
          pendingDownwardBottom = null;
          pendingDownwardCount = 0;
        }
      }

      return {
        visibleBottom: Math.max(metrics.visualTop + 1, stableVisibleBottom ?? candidate),
        geometry,
      };
    };

    const layout = () => {
      frame = 0;
      const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
      observePanel(panel);

      if (!panel || !media.matches) {
        stopPolling();
        resetFocusedGeometry();
        clearRootViewport();
        if (panel) clearMobileAuthority(panel);
        unlockPage();
        return;
      }

      const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
      const composer = panel.querySelector<HTMLElement>(COMPOSER_SELECTOR);
      if (!messages || !composer) return;

      const metrics = readMetrics();
      const focused = isComposerFocused();
      if (!focused) updateBaseline(metrics);
      const { visibleBottom, geometry } = reconcileVisibleBottom(metrics, focused);
      const visibleHeight = Math.max(1, Math.round(visibleBottom - metrics.visualTop));
      const layoutBottom = Math.max(
        baseline.visualTop + baseline.visualHeight,
        baseline.innerHeight,
        baseline.clientHeight,
      );
      const hiddenBottom = Math.max(0, Math.round(layoutBottom - visibleBottom));

      lockPage();
      startPolling();

      root.style.setProperty('--pc-visual-viewport-height', `${visibleHeight}px`);
      root.style.setProperty('--pc-visual-viewport-top', `${metrics.visualTop}px`);
      root.style.setProperty('--pc-visual-viewport-bottom', `${hiddenBottom}px`);

      panel.dataset.pcMobileViewportAuthority = 'true';
      panel.dataset.pcMobileViewportHeight = String(visibleHeight);
      panel.dataset.pcKeyboardGeometry = geometry;
      panel.style.setProperty('--pc-ai-visible-top', `${metrics.visualTop}px`);
      panel.style.setProperty('--pc-ai-visible-height', `${visibleHeight}px`);

      if (focused) {
        panel.dataset.pcKeyboardFocus = 'true';
        panel.dataset.pcKeyboardViewport = 'true';
      } else {
        delete panel.dataset.pcKeyboardFocus;
        delete panel.dataset.pcKeyboardViewport;
      }

      setImportant(panel, 'position', 'fixed');
      setImportant(panel, 'top', `${metrics.visualTop}px`);
      setImportant(panel, 'right', 'auto');
      setImportant(panel, 'bottom', 'auto');
      setImportant(panel, 'left', `${metrics.visualLeft}px`);
      setImportant(panel, 'width', `${metrics.visualWidth}px`);
      setImportant(panel, 'height', `${visibleHeight}px`);
      setImportant(panel, 'min-height', '0');
      setImportant(panel, 'max-height', `${visibleHeight}px`);
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

      // Header, messages and composer remain one flex column. No absolute footer,
      // translated clone or CSS keyboard edge may establish another coordinate system.
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
        setImportant(backdrop, 'position', 'fixed');
        setImportant(backdrop, 'top', `${metrics.visualTop}px`);
        setImportant(backdrop, 'right', 'auto');
        setImportant(backdrop, 'bottom', 'auto');
        setImportant(backdrop, 'left', `${metrics.visualLeft}px`);
        setImportant(backdrop, 'width', `${metrics.visualWidth}px`);
        setImportant(backdrop, 'height', `${visibleHeight}px`);
        setImportant(backdrop, 'min-height', '0');
        setImportant(backdrop, 'max-height', `${visibleHeight}px`);
        setImportant(backdrop, 'transform', 'none');
      }
    };

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    viewport?.addEventListener('scrollend', schedule);
    virtualKeyboard?.addEventListener('geometrychange', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    document.addEventListener('visibilitychange', schedule);
    media.addEventListener?.('change', schedule);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      stopPolling();
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      viewport?.removeEventListener('scrollend', schedule);
      virtualKeyboard?.removeEventListener('geometrychange', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('visibilitychange', schedule);
      media.removeEventListener?.('change', schedule);
      if (observedPanel) clearMobileAuthority(observedPanel);
      const backdrop = document.querySelector<HTMLElement>(BACKDROP_SELECTOR);
      if (backdrop) removeProperties(backdrop, BACKDROP_STYLE_PROPERTIES);
      clearRootViewport();
      unlockPage();
    };
  }, []);

  return null;
}
