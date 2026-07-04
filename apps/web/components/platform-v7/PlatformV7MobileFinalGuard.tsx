'use client';

import * as React from 'react';

const NOTE_TEXT = '\u041d\u0430\u0436\u0438\u043c\u0430\u044f \u00ab\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c\u00bb, \u0432\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442\u0435 \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043e\u0442\u0432\u0435\u0442\u0430 \u043d\u0430 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u0438 \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f ';
const LINK_TEXT = '\u043f\u043e\u043b\u0438\u0442\u0438\u043a\u0438 \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u0438';

function syncSupportViewportVars() {
  const viewport = window.visualViewport;
  const width = Math.max(320, Math.floor(viewport?.width ?? window.innerWidth));
  const height = Math.max(320, Math.floor(viewport?.height ?? window.innerHeight));
  const offsetLeft = Math.max(0, Math.floor(viewport?.offsetLeft ?? 0));
  const offsetTop = Math.max(0, Math.floor(viewport?.offsetTop ?? 0));
  const gutter = width <= 380 ? 8 : 10;
  const panelWidth = Math.max(280, Math.min(390, width - gutter * 2));
  const panelLeft = Math.max(gutter, Math.floor(offsetLeft + (width - panelWidth) / 2));
  const focusHeight = Math.max(320, height - 16);

  document.documentElement.style.setProperty('--p7-support-vw', `${width}px`);
  document.documentElement.style.setProperty('--p7-support-vh', `${height}px`);
  document.documentElement.style.setProperty('--p7-support-left', `${panelLeft}px`);
  document.documentElement.style.setProperty('--p7-support-top', `${offsetTop + 8}px`);
  document.documentElement.style.setProperty('--p7-support-width', `${panelWidth}px`);
  document.documentElement.style.setProperty('--p7-support-height', `${focusHeight}px`);
  document.documentElement.style.setProperty('--p7-support-gutter', `${gutter}px`);
}

function patchSupportNote() {
  document.querySelectorAll<HTMLElement>('.p7-support-chat-form small').forEach((node) => {
    if (node.dataset.p7SupportNotePatched === 'yes') return;

    node.textContent = '';
    node.append(NOTE_TEXT);

    const link = document.createElement('a');
    link.href = '/platform-v7/privacy';
    link.textContent = LINK_TEXT;
    link.style.color = '#087a3b';
    link.style.fontWeight = '850';
    link.style.textDecoration = 'underline';
    link.style.textUnderlineOffset = '2px';
    node.append(link, '.');

    node.dataset.p7SupportNotePatched = 'yes';
  });
}

function clampViewport() {
  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100%';
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100%';
  document.body.style.overflowX = 'hidden';
  syncSupportViewportVars();
  patchSupportNote();

  if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  document.querySelectorAll<HTMLElement>('.pc-v7-public-entry,.p7-contact-page,.pc-shell-root-v4,.pc-v4-main,.p7-support-chat-panel').forEach((node) => {
    node.style.maxWidth = node.classList.contains('p7-support-chat-panel') ? 'var(--p7-support-width, calc(100dvw - 20px))' : '100%';
    node.style.overflowX = 'hidden';
    node.scrollLeft = 0;
  });
}

const css = `
html, body {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
  overscroll-behavior-x: none !important;
}

.pc-v7-public-entry,
.p7-contact-page,
.pc-shell-root-v4,
.pc-v4-main {
  max-width: 100% !important;
  overflow-x: hidden !important;
}

.p7-support-chat-panel {
  left: var(--p7-support-left, 10px) !important;
  right: auto !important;
  transform: none !important;
  width: var(--p7-support-width, calc(100dvw - 20px)) !important;
  max-width: var(--p7-support-width, calc(100dvw - 20px)) !important;
  overflow-x: hidden !important;
  contain: layout paint;
}

.p7-support-chat-panel:focus-within {
  top: var(--p7-support-top, 8px) !important;
  bottom: auto !important;
  height: var(--p7-support-height, calc(100dvh - 16px)) !important;
  max-height: var(--p7-support-height, calc(100dvh - 16px)) !important;
}

.p7-support-chat-panel * {
  box-sizing: border-box !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

.p7-support-chat-form,
.p7-support-chat-success {
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
}

.p7-support-chat-form input,
.p7-support-chat-form textarea,
.p7-support-chat-form select,
.p7-support-chat-form button {
  font-size: 16px !important;
  max-width: 100% !important;
  touch-action: manipulation !important;
}
`;

export function PlatformV7MobileFinalGuard() {
  React.useEffect(() => {
    clampViewport();
    const observer = new MutationObserver(clampViewport);
    observer.observe(document.body, { childList: true, subtree: true });
    const timers = [40, 120, 260, 600, 1200, 2400].map((delay) => window.setTimeout(clampViewport, delay));
    window.addEventListener('resize', clampViewport);
    window.addEventListener('orientationchange', clampViewport);
    window.visualViewport?.addEventListener('resize', clampViewport);
    window.visualViewport?.addEventListener('scroll', clampViewport);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', clampViewport);
      window.removeEventListener('orientationchange', clampViewport);
      window.visualViewport?.removeEventListener('resize', clampViewport);
      window.visualViewport?.removeEventListener('scroll', clampViewport);
    };
  }, []);
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
