'use client';

import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 720px)';
const PANEL_SELECTOR = '.pc-public-assistant-panel';
const BACKDROP_SELECTOR = '.pc-public-assistant-backdrop';
const MESSAGES_SELECTOR = '.pc-public-assistant-messages';
const COMPOSER_SELECTOR = '.pc-public-assistant-composer';
const FOOTER_SELECTORS = new Set([
  'pc-public-assistant-error',
  'pc-public-assistant-reset-proxy',
  'pc-public-assistant-composer',
]);

const PANEL_STYLE_PROPERTIES = [
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-height',
  'max-height',
  'padding-bottom',
  'display',
  'flex-direction',
  'overflow',
] as const;

const FOOTER_STYLE_PROPERTIES = [
  'position',
  'right',
  'bottom',
  'left',
  'width',
  'margin',
  'z-index',
] as const;

const MESSAGE_STYLE_PROPERTIES = [
  'flex',
  'min-height',
  'max-height',
  'overflow-x',
  'overflow-y',
] as const;

function inlinePixelVariable(root: HTMLElement, name: string): number | null {
  const raw = root.style.getPropertyValue(name).trim();
  if (!/^-?\d+(?:\.\d+)?px$/u.test(raw)) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function removeProperties(node: HTMLElement, properties: readonly string[]) {
  for (const property of properties) node.style.removeProperty(property);
}

function directFooterNodes(panel: HTMLElement, messages: HTMLElement): HTMLElement[] {
  const children = Array.from(panel.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const messageIndex = children.indexOf(messages);
  if (messageIndex < 0) return [];

  return children.slice(messageIndex + 1).filter((node) => (
    Array.from(FOOTER_SELECTORS).some((className) => node.classList.contains(className))
  ));
}

function clearMobileAuthority(panel: HTMLElement) {
  delete panel.dataset.pcMobileFooterAuthority;
  delete panel.dataset.pcMobileFooterHeight;
  removeProperties(panel, PANEL_STYLE_PROPERTIES);

  const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
  if (messages) removeProperties(messages, MESSAGE_STYLE_PROPERTIES);

  for (const node of panel.querySelectorAll<HTMLElement>(
    '.pc-public-assistant-error, .pc-public-assistant-reset-proxy, .pc-public-assistant-composer',
  )) {
    removeProperties(node, FOOTER_STYLE_PROPERTIES);
  }
}

export function PublicAssistantMobileLayoutAuthority() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const media = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    let pollTimer = 0;
    let observedPanel: HTMLElement | null = null;
    const resizeObserver = new ResizeObserver(() => schedule());

    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(layout);
    };

    const stopPolling = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = 0;
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = window.setInterval(schedule, 180);
    };

    const observePanel = (panel: HTMLElement | null) => {
      if (panel === observedPanel) return;
      resizeObserver.disconnect();
      observedPanel = panel;
      if (!panel) return;
      resizeObserver.observe(panel);
      for (const node of panel.querySelectorAll<HTMLElement>(
        '.pc-public-assistant-header, .pc-public-assistant-error, .pc-public-assistant-reset-proxy, .pc-public-assistant-composer',
      )) {
        resizeObserver.observe(node);
      }
    };

    const layout = () => {
      frame = 0;
      const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
      observePanel(panel);

      if (!panel || !media.matches) {
        stopPolling();
        if (panel) clearMobileAuthority(panel);
        return;
      }

      startPolling();

      const messages = panel.querySelector<HTMLElement>(MESSAGES_SELECTOR);
      const composer = panel.querySelector<HTMLElement>(COMPOSER_SELECTOR);
      if (!messages || !composer) return;

      const visualTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const visualHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const visualBottom = visualTop + visualHeight;
      const layoutHeight = Math.max(
        visualBottom,
        Math.round(window.innerHeight),
        Math.round(root.clientHeight),
      );

      const authoritativeTop = inlinePixelVariable(root, '--pc-visual-viewport-top') ?? visualTop;
      const authoritativeBottomInset = inlinePixelVariable(root, '--pc-visual-viewport-bottom')
        ?? Math.max(0, layoutHeight - visualBottom);
      const safeTop = Math.max(0, Math.min(authoritativeTop, layoutHeight - 1));
      const safeBottom = Math.max(
        0,
        Math.min(authoritativeBottomInset, Math.max(0, layoutHeight - safeTop - 1)),
      );

      panel.dataset.pcMobileFooterAuthority = 'true';
      panel.style.setProperty('top', `${safeTop}px`, 'important');
      panel.style.setProperty('right', '0', 'important');
      panel.style.setProperty('bottom', `${safeBottom}px`, 'important');
      panel.style.setProperty('left', '0', 'important');
      panel.style.setProperty('width', '100%', 'important');
      panel.style.setProperty('height', 'auto', 'important');
      panel.style.setProperty('min-height', '0', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
      panel.style.setProperty('display', 'flex', 'important');
      panel.style.setProperty('flex-direction', 'column', 'important');
      panel.style.setProperty('overflow', 'hidden', 'important');

      messages.style.setProperty('flex', '1 1 0%', 'important');
      messages.style.setProperty('min-height', '0', 'important');
      messages.style.setProperty('max-height', 'none', 'important');
      messages.style.setProperty('overflow-x', 'hidden', 'important');
      messages.style.setProperty('overflow-y', 'auto', 'important');

      const footerNodes = directFooterNodes(panel, messages);
      let bottomOffset = 0;
      for (const node of [...footerNodes].reverse()) {
        const height = Math.max(0, Math.ceil(node.getBoundingClientRect().height));
        node.style.setProperty('position', 'absolute', 'important');
        node.style.setProperty('right', '0', 'important');
        node.style.setProperty('bottom', `${bottomOffset}px`, 'important');
        node.style.setProperty('left', '0', 'important');
        node.style.setProperty('width', '100%', 'important');
        node.style.setProperty('margin', '0', 'important');
        node.style.setProperty('z-index', '5', 'important');
        bottomOffset += height;
      }

      const composerHeight = Math.max(1, Math.ceil(composer.getBoundingClientRect().height));
      const footerHeight = Math.max(composerHeight, bottomOffset);
      panel.dataset.pcMobileFooterHeight = String(footerHeight);
      panel.style.setProperty('padding-bottom', `${footerHeight}px`, 'important');

      const backdrop = document.querySelector<HTMLElement>(BACKDROP_SELECTOR);
      if (backdrop) {
        backdrop.style.setProperty('top', `${safeTop}px`, 'important');
        backdrop.style.setProperty('right', '0', 'important');
        backdrop.style.setProperty('bottom', `${safeBottom}px`, 'important');
        backdrop.style.setProperty('left', '0', 'important');
        backdrop.style.setProperty('width', 'auto', 'important');
        backdrop.style.setProperty('height', 'auto', 'important');
      }
    };

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
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
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('visibilitychange', schedule);
      media.removeEventListener?.('change', schedule);
      if (observedPanel) clearMobileAuthority(observedPanel);
    };
  }, []);

  return null;
}
