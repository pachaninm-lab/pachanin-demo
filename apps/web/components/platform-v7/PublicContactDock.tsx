'use client';

import * as React from 'react';
import { MessageCircle, Phone, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Surface = 'assistant' | 'support';

const SUPPORT_PHONE_DISPLAY = '8 916 277-89-89';
const SUPPORT_PHONE_HREF = 'tel:+79162778989';

const COPY = {
  ru: {
    assistant: 'ИИ',
    assistantAria: 'Открыть ИИ-помощника по платформе',
    support: 'Поддержка',
    supportAria: 'Открыть поддержку',
    call: 'Позвонить',
    callAria: `Позвонить по номеру ${SUPPORT_PHONE_DISPLAY}`,
    group: 'Связь и помощь',
  },
  en: {
    assistant: 'AI',
    assistantAria: 'Open the platform AI assistant',
    support: 'Support',
    supportAria: 'Open support',
    call: 'Call',
    callAria: `Call ${SUPPORT_PHONE_DISPLAY}`,
    group: 'Help and contact',
  },
  zh: {
    assistant: 'AI 助手',
    assistantAria: '打开平台 AI 助手',
    support: '支持',
    supportAria: '打开支持',
    call: '致电',
    callAria: `拨打 ${SUPPORT_PHONE_DISPLAY}`,
    group: '帮助与联系',
  },
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

export function PublicContactDock() {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const assistantButtonRef = React.useRef<HTMLButtonElement>(null);
  const supportButtonRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<Surface | null>(null);
  const openStateRef = React.useRef({ assistant: false, support: false });
  const ui = COPY[locale];

  React.useEffect(() => setLocale(resolveLocale()), []);

  React.useEffect(() => {
    const assistantTrigger = document.querySelector<HTMLButtonElement>('.pc-public-assistant-shortcut');
    const supportTrigger = document.querySelector<HTMLButtonElement>('.p7-support-chat-button');
    const triggers = [assistantTrigger, supportTrigger].filter((node): node is HTMLButtonElement => Boolean(node));
    const previous = triggers.map((node) => ({
      node,
      tabIndex: node.getAttribute('tabindex'),
      ariaHidden: node.getAttribute('aria-hidden'),
    }));

    for (const trigger of triggers) {
      trigger.setAttribute('tabindex', '-1');
      trigger.setAttribute('aria-hidden', 'true');
    }

    const syncOpenState = () => {
      const assistantOpen = Boolean(document.querySelector('#pc-public-assistant-panel'));
      const supportOpen = Boolean(document.querySelector('.p7-support-chat-panel'));
      const previousOpen = openStateRef.current;
      const focusTarget = returnFocusRef.current;

      setDialogOpen(assistantOpen || supportOpen);

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
      for (const entry of previous) {
        restoreAttribute(entry.node, 'tabindex', entry.tabIndex);
        restoreAttribute(entry.node, 'aria-hidden', entry.ariaHidden);
      }
    };
  }, []);

  const openSurface = (surface: Surface) => {
    const selector = surface === 'assistant' ? '.pc-public-assistant-shortcut' : '.p7-support-chat-button';
    const trigger = document.querySelector<HTMLButtonElement>(selector);
    if (!trigger) return;
    returnFocusRef.current = surface;
    trigger.click();
  };

  return (
    <nav
      className='pc-public-contact-dock'
      aria-label={ui.group}
      aria-hidden={dialogOpen}
      data-dialog-open={dialogOpen ? 'true' : 'false'}
    >
      <button
        ref={assistantButtonRef}
        type='button'
        className='pc-public-contact-dock-action'
        aria-label={ui.assistantAria}
        aria-haspopup='dialog'
        aria-controls='pc-public-assistant-panel'
        onClick={() => openSurface('assistant')}
      >
        <Sparkles size={21} strokeWidth={2.2} aria-hidden='true' />
        <strong>{ui.assistant}</strong>
      </button>

      <button
        ref={supportButtonRef}
        type='button'
        className='pc-public-contact-dock-action'
        aria-label={ui.supportAria}
        aria-haspopup='dialog'
        onClick={() => openSurface('support')}
      >
        <MessageCircle size={21} strokeWidth={2.2} aria-hidden='true' />
        <strong>{ui.support}</strong>
      </button>

      <a
        className='pc-public-contact-dock-action pc-public-contact-dock-call'
        href={SUPPORT_PHONE_HREF}
        aria-label={ui.callAria}
        onClick={() => trackEvent('public_support_phone_clicked', { source: 'unified_contact_dock' })}
      >
        <Phone size={21} strokeWidth={2.2} aria-hidden='true' />
        <span>
          <strong>{ui.call}</strong>
          <small>{SUPPORT_PHONE_DISPLAY}</small>
        </span>
      </a>

      <style>{css}</style>
    </nav>
  );
}

const css = `
.pc-public-assistant-shortcut,
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
  right: max(10px, env(safe-area-inset-right, 0px));
  bottom: max(6px, calc(env(safe-area-inset-bottom, 0px) + 4px));
  z-index: 2147482995;
  width: min(430px, calc(100vw - 20px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-template-columns: .78fr 1.05fr 1.42fr;
  overflow: hidden;
  border: 1px solid var(--pc-ppe-v5-line, #cfdcd4);
  border-radius: var(--pc-ppe-v5-radius, 14px);
  background: var(--pc-ppe-v5-surface, #ffffff);
  box-shadow: 0 10px 28px rgba(9, 33, 24, .14);
  color: var(--pc-ppe-v5-ink, #092118);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.pc-public-contact-dock[data-dialog-open='true'] {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.pc-public-contact-dock,
.pc-public-contact-dock * { box-sizing: border-box; min-width: 0; }
.pc-public-contact-dock-action {
  min-height: 62px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 10px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.pc-public-contact-dock-action + .pc-public-contact-dock-action {
  border-left: 1px solid var(--pc-ppe-v5-line, #cfdcd4);
}
.pc-public-contact-dock-action:hover { background: #eef5f0; }
.pc-public-contact-dock-action:active { background: #e1efe6; }
.pc-public-contact-dock-action:focus-visible {
  position: relative;
  z-index: 1;
  outline: 3px solid var(--pc-ppe-v5-green, #087a3b);
  outline-offset: -4px;
}
.pc-public-contact-dock-action svg {
  flex: 0 0 auto;
  color: var(--pc-ppe-v5-green, #087a3b);
}
.pc-public-contact-dock-action strong {
  display: block;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: -.01em;
  white-space: nowrap;
}
.pc-public-contact-dock-call > span { display: grid; gap: 2px; text-align: left; }
.pc-public-contact-dock-call small {
  display: block;
  color: var(--pc-ppe-v5-muted, #52635b);
  font-size: 10px;
  line-height: 1.1;
  font-weight: 680;
  letter-spacing: .01em;
  white-space: nowrap;
}
@media (max-width: 520px) {
  .pc-public-contact-dock {
    right: max(8px, env(safe-area-inset-right, 0px));
    left: max(8px, env(safe-area-inset-left, 0px));
    bottom: max(2px, calc(env(safe-area-inset-bottom, 0px) + 2px));
    width: auto;
    grid-template-columns: .72fr 1fr 1.38fr;
    border-radius: var(--pc-ppe-v5-radius, 14px);
  }
  .pc-public-contact-dock-action {
    min-height: 58px;
    gap: 6px;
    padding-inline: 7px;
  }
  .pc-public-contact-dock-action strong { font-size: 12px; }
  .pc-public-contact-dock-call small { font-size: 9px; }
}
@media (max-width: 350px) {
  .pc-public-contact-dock-action { gap: 4px; padding-inline: 5px; }
  .pc-public-contact-dock-action svg { width: 19px; height: 19px; }
  .pc-public-contact-dock-action strong { font-size: 11px; }
  .pc-public-contact-dock-call small { font-size: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-public-contact-dock-action { transition: none; animation: none; }
}
@media (forced-colors: active) {
  .pc-public-contact-dock { border: 2px solid ButtonText; }
  .pc-public-contact-dock-action + .pc-public-contact-dock-action { border-left: 2px solid ButtonText; }
  .pc-public-contact-dock-action svg, .pc-public-contact-dock-call small { color: ButtonText; }
}
`;
