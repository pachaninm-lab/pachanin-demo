'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

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

function clampViewport() {
  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100%';
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100%';
  document.body.style.overflowX = 'hidden';
  syncSupportViewportVars();

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
html,
body {
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

.pc-v7-public-entry .entry-brand-mark {
  display: inline-block !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background-image: url('${BRAND_LOGO_DATA_URI}') !important;
  background-size: contain !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  color: transparent !important;
  box-shadow: none !important;
}

.pc-v7-public-entry .entry-brand-mark svg {
  display: none !important;
}

.p7-support-chat-button {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 96px) !important;
}

.p7-support-chat-panel {
  left: var(--p7-support-left, calc((100dvw - min(390px, calc(100dvw - 24px))) / 2)) !important;
  right: auto !important;
  transform: none !important;
  width: var(--p7-support-width, min(390px, calc(100dvw - 24px))) !important;
  max-width: var(--p7-support-width, min(390px, calc(100dvw - 24px))) !important;
  overflow: hidden !important;
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

.pc-v7-public-entry input[name='name']::placeholder,
.pc-v7-public-entry input[name='contact']::placeholder,
.pc-v7-public-entry input[name='email']::placeholder,
.pc-v7-public-entry input[name='phone']::placeholder,
.pc-v7-public-entry input[type='email']::placeholder,
.pc-v7-public-entry input[type='tel']::placeholder,
.pc-v7-public-entry input[autocomplete='name']::placeholder,
.pc-v7-public-entry input[autocomplete='email']::placeholder,
.pc-v7-public-entry input[autocomplete='tel']::placeholder,
.p7-contact-page input[name='name']::placeholder,
.p7-contact-page input[name='contact']::placeholder,
.p7-contact-page input[name='email']::placeholder,
.p7-contact-page input[name='phone']::placeholder,
.p7-contact-page input[type='email']::placeholder,
.p7-contact-page input[type='tel']::placeholder,
.p7-contact-page input[autocomplete='name']::placeholder,
.p7-contact-page input[autocomplete='email']::placeholder,
.p7-contact-page input[autocomplete='tel']::placeholder,
.pc-v7-login-single input[name='email']::placeholder,
.pc-v7-login-single input[type='email']::placeholder,
.pc-v7-login-single input[autocomplete='email']::placeholder,
.p7-support-chat-panel input[autocomplete='name']::placeholder,
.p7-support-chat-panel input[autocomplete='email']::placeholder,
.p7-support-chat-panel input[type='email']::placeholder,
.p7-support-chat-panel input[type='tel']::placeholder {
  color: transparent !important;
  opacity: 0 !important;
}

.pc-v7-public-entry input[name='name']::-webkit-input-placeholder,
.pc-v7-public-entry input[name='contact']::-webkit-input-placeholder,
.pc-v7-public-entry input[name='email']::-webkit-input-placeholder,
.pc-v7-public-entry input[name='phone']::-webkit-input-placeholder,
.pc-v7-public-entry input[type='email']::-webkit-input-placeholder,
.pc-v7-public-entry input[type='tel']::-webkit-input-placeholder,
.pc-v7-public-entry input[autocomplete='name']::-webkit-input-placeholder,
.pc-v7-public-entry input[autocomplete='email']::-webkit-input-placeholder,
.pc-v7-public-entry input[autocomplete='tel']::-webkit-input-placeholder,
.p7-contact-page input[name='name']::-webkit-input-placeholder,
.p7-contact-page input[name='contact']::-webkit-input-placeholder,
.p7-contact-page input[name='email']::-webkit-input-placeholder,
.p7-contact-page input[name='phone']::-webkit-input-placeholder,
.p7-contact-page input[type='email']::-webkit-input-placeholder,
.p7-contact-page input[type='tel']::-webkit-input-placeholder,
.p7-contact-page input[autocomplete='name']::-webkit-input-placeholder,
.p7-contact-page input[autocomplete='email']::-webkit-input-placeholder,
.p7-contact-page input[autocomplete='tel']::-webkit-input-placeholder,
.pc-v7-login-single input[name='email']::-webkit-input-placeholder,
.pc-v7-login-single input[type='email']::-webkit-input-placeholder,
.pc-v7-login-single input[autocomplete='email']::-webkit-input-placeholder,
.p7-support-chat-panel input[autocomplete='name']::-webkit-input-placeholder,
.p7-support-chat-panel input[autocomplete='email']::-webkit-input-placeholder,
.p7-support-chat-panel input[type='email']::-webkit-input-placeholder,
.p7-support-chat-panel input[type='tel']::-webkit-input-placeholder {
  color: transparent !important;
  opacity: 0 !important;
}

@media (max-width: 720px) {
  .pc-v7-public-entry {
    padding-bottom: calc(170px + env(safe-area-inset-bottom, 0px)) !important;
  }

  .pc-v7-public-entry .entry-header {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
    right: 0 !important;
    overflow: hidden !important;
  }

  .pc-v7-public-entry .entry-brand {
    max-width: calc(100dvw - 122px) !important;
    overflow: hidden !important;
  }

  .pc-v7-public-entry .entry-brand strong {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .pc-v7-public-entry .entry-login {
    min-width: 88px !important;
    max-width: 96px !important;
    padding: 0 12px !important;
    white-space: nowrap !important;
  }

  .pc-v7-public-entry .entry-hero {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
    overflow: hidden !important;
  }

  .pc-v7-public-entry .entry-hero-copy {
    width: 100% !important;
    max-width: 100% !important;
    padding: 20px 16px !important;
    overflow: hidden !important;
  }

  .pc-v7-public-entry .entry-kicker {
    width: 100% !important;
    max-width: 100% !important;
    white-space: normal !important;
    text-align: center !important;
    justify-content: center !important;
  }

  .pc-v7-public-entry .entry-hero h1 {
    font-size: clamp(32px, 8.7vw, 38px) !important;
    line-height: 1.04 !important;
    letter-spacing: -.055em !important;
    text-wrap: balance !important;
  }

  .pc-v7-public-entry .entry-hero p {
    font-size: clamp(15px, 4.1vw, 17px) !important;
    line-height: 1.43 !important;
  }

  .pc-v7-public-entry .entry-hero-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
  }

  .pc-v7-public-entry .entry-primary-cta,
  .pc-v7-public-entry .entry-secondary-cta,
  .pc-v7-public-entry .entry-register-cta {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    white-space: normal !important;
    text-align: center !important;
  }

  .p7-support-chat-button {
    right: max(14px, env(safe-area-inset-right, 0px)) !important;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 100px) !important;
  }

  .p7-support-chat-panel {
    left: var(--p7-support-left, 10px) !important;
    right: auto !important;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 184px) !important;
    top: auto !important;
    transform: none !important;
    width: var(--p7-support-width, calc(100dvw - 20px)) !important;
    max-width: var(--p7-support-width, calc(100dvw - 20px)) !important;
    max-height: calc(var(--p7-support-vh, 100dvh) - 236px) !important;
  }

  .p7-support-chat-panel:focus-within {
    top: var(--p7-support-top, 8px) !important;
    bottom: auto !important;
    height: var(--p7-support-height, calc(100dvh - 16px)) !important;
    max-height: var(--p7-support-height, calc(100dvh - 16px)) !important;
  }
}
`;

export function PlatformV7MobileFinalGuard() {
  React.useEffect(() => {
    clampViewport();
    const timers = [40, 120, 260, 600, 1200, 2400].map((delay) => window.setTimeout(clampViewport, delay));
    window.addEventListener('resize', clampViewport);
    window.addEventListener('orientationchange', clampViewport);
    window.visualViewport?.addEventListener('resize', clampViewport);
    window.visualViewport?.addEventListener('scroll', clampViewport);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', clampViewport);
      window.removeEventListener('orientationchange', clampViewport);
      window.visualViewport?.removeEventListener('resize', clampViewport);
      window.visualViewport?.removeEventListener('scroll', clampViewport);
    };
  }, []);
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
