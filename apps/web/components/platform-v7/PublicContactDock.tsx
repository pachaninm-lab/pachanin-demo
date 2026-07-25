'use client';

import * as React from 'react';
import { MessageCircle, Phone, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Surface = 'assistant' | 'support';
type AssistantContext = 'public' | 'private' | 'workspace';

const SUPPORT_PHONE_DISPLAY = '8 916 277-89-89';
const SUPPORT_PHONE_HREF = 'tel:+79162778989';

const COPY = {
  ru: { assistant: 'ИИ', assistantAria: 'Открыть ИИ-помощника по платформе', support: 'Поддержка', supportAria: 'Открыть поддержку', call: 'Позвонить', callAria: `Позвонить по номеру ${SUPPORT_PHONE_DISPLAY}`, group: 'Связь и помощь' },
  en: { assistant: 'AI', assistantAria: 'Open the platform AI assistant', support: 'Support', supportAria: 'Open support', call: 'Call', callAria: `Call ${SUPPORT_PHONE_DISPLAY}`, group: 'Help and contact' },
  zh: { assistant: 'AI 助手', assistantAria: '打开平台 AI 助手', support: '支持', supportAria: '打开支持', call: '致电', callAria: `拨打 ${SUPPORT_PHONE_DISPLAY}`, group: '帮助与联系' },
} as const;

function resolveLocale(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const html = document.documentElement.lang.toLowerCase();
  if (html.startsWith('en')) return 'en';
  if (html.startsWith('zh')) return 'zh';
  return 'ru';
}

function restoreAttribute(node: HTMLElement, name: string, value: string | null) {
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

export function PublicContactDock({ assistantContext = 'public' }: { assistantContext?: AssistantContext }) {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [hiddenByScroll, setHiddenByScroll] = React.useState(false);
  const assistantButtonRef = React.useRef<HTMLButtonElement>(null);
  const supportButtonRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<Surface | null>(null);
  const openStateRef = React.useRef({ assistant: false, support: false });
  const ui = COPY[locale];
  const assistantTriggerSelector = assistantContext === 'workspace'
    ? null
    : assistantContext === 'private'
      ? '.p7-ai-trigger'
      : '.pc-public-assistant-shortcut';
  const assistantPanelSelector = assistantContext === 'workspace'
    ? '#p7-private-ai-assistant-workspace'
    : assistantContext === 'private'
      ? '#p7-private-ai-assistant-panel'
      : '#pc-public-assistant-panel';

  React.useEffect(() => setLocale(resolveLocale()), []);

  React.useEffect(() => {
    let previousY = window.scrollY;
    let accumulatedDelta = 0;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - previousY;

        if ((delta > 0 && accumulatedDelta < 0) || (delta < 0 && accumulatedDelta > 0)) accumulatedDelta = 0;
        accumulatedDelta += delta;

        if (currentY < 120) {
          setHiddenByScroll(false);
          accumulatedDelta = 0;
        } else if (accumulatedDelta > 8) {
          setHiddenByScroll(true);
          accumulatedDelta = 0;
        } else if (accumulatedDelta < -8) {
          setHiddenByScroll(false);
          accumulatedDelta = 0;
        }

        previousY = currentY;
        frame = 0;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  React.useEffect(() => {
    const assistantTrigger = assistantTriggerSelector ? document.querySelector<HTMLButtonElement>(assistantTriggerSelector) : null;
    const supportTrigger = document.querySelector<HTMLButtonElement>('.p7-support-chat-button');
    const triggers = [assistantTrigger, supportTrigger].filter((node): node is HTMLButtonElement => Boolean(node));
    const previous = triggers.map((node) => ({ node, tabIndex: node.getAttribute('tabindex'), ariaHidden: node.getAttribute('aria-hidden') }));

    for (const trigger of triggers) {
      trigger.setAttribute('tabindex', '-1');
      trigger.setAttribute('aria-hidden', 'true');
    }

    const syncOpenState = () => {
      const assistantOpen = assistantContext !== 'workspace' && Boolean(document.querySelector(assistantPanelSelector));
      const supportOpen = Boolean(document.querySelector('.p7-support-chat-panel'));
      const blockingModalOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
      const previousOpen = openStateRef.current;
      const focusTarget = returnFocusRef.current;

      setDialogOpen(assistantOpen || supportOpen || blockingModalOpen);
      if (previousOpen.assistant && !assistantOpen && focusTarget === 'assistant') {
        returnFocusRef.current = null;
        window.requestAnimationFrame(() => assistantButtonRef.current?.focus());
      }
      if (previousOpen.support && !supportOpen && focusTarget === 'support') {
        returnFocusRef.current = null;
        window.requestAnimationFrame(() => supportButtonRef.current?.focus());
      }
      openStateRef.current = { assistant: assistantOpen, support: supportOpen };
    };

    syncOpenState();
    const observer = new MutationObserver(syncOpenState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const entry of previous) restoreAttribute(entry.node, 'tabindex', entry.tabIndex);
      for (const entry of previous) restoreAttribute(entry.node, 'aria-hidden', entry.ariaHidden);
    };
  }, [assistantContext, assistantPanelSelector, assistantTriggerSelector]);

  const openSurface = (surface: Surface) => {
    setHiddenByScroll(false);
    if (surface === 'assistant' && assistantContext === 'workspace') {
      const workspace = document.querySelector<HTMLElement>(assistantPanelSelector);
      if (!workspace) return;
      workspace.scrollIntoView({ block: 'start', behavior: 'smooth' });
      window.requestAnimationFrame(() => workspace.focus({ preventScroll: true }));
      return;
    }
    const selector = surface === 'assistant' ? assistantTriggerSelector : '.p7-support-chat-button';
    if (!selector) return;
    const trigger = document.querySelector<HTMLButtonElement>(selector);
    if (!trigger) return;
    returnFocusRef.current = surface;
    trigger.click();
  };

  const hidden = dialogOpen || hiddenByScroll;

  return (
    <nav
      className='pc-public-contact-dock'
      aria-label={ui.group}
      data-dialog-open={dialogOpen ? 'true' : 'false'}
      data-scroll-hidden={hiddenByScroll ? 'true' : 'false'}
      data-assistant-context={assistantContext}
    >
      <button ref={assistantButtonRef} type='button' disabled={hidden} tabIndex={hidden ? -1 : 0} className='pc-public-contact-dock-action pc-public-contact-dock-assistant' aria-label={ui.assistantAria} aria-haspopup={assistantContext === 'workspace' ? undefined : 'dialog'} aria-controls={assistantPanelSelector.slice(1)} onClick={() => openSurface('assistant')}>
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><Sparkles size={17} strokeWidth={2.15} /></span>
        <strong>{ui.assistant}</strong>
      </button>
      <button ref={supportButtonRef} type='button' disabled={hidden} tabIndex={hidden ? -1 : 0} className='pc-public-contact-dock-action' aria-label={ui.support} aria-haspopup='dialog' onClick={() => openSurface('support')}>
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><MessageCircle size={17} strokeWidth={2.1} /></span>
        <strong>{ui.support}</strong>
      </button>
      <a className='pc-public-contact-dock-action pc-public-contact-dock-call' tabIndex={hidden ? -1 : 0} href={SUPPORT_PHONE_HREF} aria-label={ui.callAria} onClick={() => trackEvent('public_support_phone_clicked', { source: 'unified_contact_dock', assistantContext })}>
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><Phone size={17} strokeWidth={2.1} /></span>
        <strong>{ui.call}</strong>
      </a>
      <style>{css}</style>
    </nav>
  );
}

const css = `
.pc-public-assistant-shortcut,
.p7-ai-trigger,
.p7-support-chat-button {
  position: fixed !important;
  width: 1px !important;
  min-width: 1px !important;
  max-width: 1px !important;
  height: 1px !important;
  min-height: 1px !important;
  max-height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
  border: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
.pc-public-contact-dock {
  position: fixed;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) + 8px));
  z-index: 2147482995;
  width: min(334px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid rgba(8, 122, 59, .42);
  border-radius: 15px;
  background: color-mix(in srgb, var(--pc-ppe-v5-surface, #ffffff) 96%, transparent);
  box-shadow: 0 12px 30px rgba(9, 33, 24, .11), 0 2px 8px rgba(8, 122, 59, .05), inset 0 1px 0 rgba(255, 255, 255, .94);
  color: var(--pc-ppe-v5-ink, #092118);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  backdrop-filter: blur(14px) saturate(125%);
  -webkit-backdrop-filter: blur(14px) saturate(125%);
  transform: translateY(0);
  transform-origin: bottom right;
  transition: transform .2s ease, visibility .18s ease;
}
.pc-public-contact-dock[data-dialog-open='true'],
.pc-public-contact-dock[data-scroll-hidden='true'] {
  visibility: hidden;
  pointer-events: none;
  transform: translateY(calc(100% + 24px));
}
.pc-public-contact-dock[data-assistant-context='private'],
.pc-public-contact-dock[data-assistant-context='workspace'] {
  bottom: max(92px, calc(env(safe-area-inset-bottom, 0px) + 88px));
  z-index: 97;
}
.pc-shell-root-v4 .pc-v4-main { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 132px); }
.pc-public-contact-dock,
.pc-public-contact-dock * { box-sizing: border-box; min-width: 0; }
.pc-public-contact-dock-action {
  min-height: 48px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 6px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.pc-public-contact-dock-action:disabled {
  color: inherit;
  opacity: 1;
  -webkit-text-fill-color: currentColor;
  cursor: default;
}
.pc-public-contact-dock-icon {
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--pc-ppe-v5-green, #087a3b);
  background: linear-gradient(145deg, rgba(8, 122, 59, .12), rgba(8, 122, 59, .045));
  box-shadow: inset 0 0 0 1px rgba(8, 122, 59, .13);
}
.pc-public-contact-dock-icon svg { display: block; }
.pc-public-contact-dock-action strong { display: block; font-size: 12px; line-height: 1.1; font-weight: 700; letter-spacing: -.005em; white-space: nowrap; }
.pc-public-contact-dock-assistant .pc-public-contact-dock-icon { color: var(--pc-ppe-v5-green-dark, #07572e); background: linear-gradient(145deg, rgba(8, 122, 59, .19), rgba(8, 122, 59, .08)); box-shadow: inset 0 0 0 1px rgba(8, 122, 59, .22); }
.pc-public-contact-dock-assistant strong { color: var(--pc-ppe-v5-green-dark, #07572e); font-weight: 780; }
@media (hover: hover) {
  .pc-public-contact-dock-action:hover:not(:disabled) { background: rgba(8, 122, 59, .065); transform: translateY(-1px); }
  .pc-public-contact-dock-action:hover:not(:disabled) .pc-public-contact-dock-icon { color: #ffffff; background: var(--pc-ppe-v5-green, #087a3b); box-shadow: 0 4px 10px rgba(8, 122, 59, .18); }
}
.pc-public-contact-dock-action:active { background: rgba(8, 122, 59, .10); transform: translateY(0) scale(.985); }
.pc-public-contact-dock-action:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--pc-ppe-v5-green, #087a3b); outline-offset: -2px; box-shadow: 0 0 0 3px rgba(8, 122, 59, .14); }
@media (max-width: 350px) {
  .pc-public-contact-dock { right: max(8px, env(safe-area-inset-right, 0px)); width: min(304px, calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); }
  .pc-public-contact-dock-action { gap: 4px; padding-inline: 3px; }
  .pc-public-contact-dock-icon { width: 24px; height: 24px; flex-basis: 24px; }
  .pc-public-contact-dock-icon svg { width: 16px; height: 16px; }
  .pc-public-contact-dock-action strong { font-size: 10.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-public-contact-dock,
  .pc-public-contact-dock-action,
  .pc-public-contact-dock-icon { transition: none; animation: none; }
}
@media (forced-colors: active) {
  .pc-public-contact-dock { border: 2px solid ButtonText; background: Canvas; box-shadow: none; }
  .pc-public-contact-dock-action,
  .pc-public-contact-dock-assistant strong { color: ButtonText; }
  .pc-public-contact-dock-icon,
  .pc-public-contact-dock-assistant .pc-public-contact-dock-icon { color: ButtonText; background: Canvas; box-shadow: inset 0 0 0 1px ButtonText; }
}
`;
