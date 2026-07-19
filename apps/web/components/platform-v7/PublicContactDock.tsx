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
        <span className='pc-public-contact-dock-icon' aria-hidden='true'>
          <Sparkles size={18} strokeWidth={2.1} />
        </span>
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
        <span className='pc-public-contact-dock-icon' aria-hidden='true'>
          <MessageCircle size={18} strokeWidth={2.1} />
        </span>
        <strong>{ui.support}</strong>
      </button>

      <a
        className='pc-public-contact-dock-action pc-public-contact-dock-call'
        href={SUPPORT_PHONE_HREF}
        aria-label={ui.callAria}
        onClick={() => trackEvent('public_support_phone_clicked', { source: 'unified_contact_dock' })}
      >
        <span className='pc-public-contact-dock-icon' aria-hidden='true'>
          <Phone size={18} strokeWidth={2.1} />
        </span>
        <strong>{ui.call}</strong>
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
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: max(6px, calc(env(safe-area-inset-bottom, 0px) + 4px));
  z-index: 2147482995;
  width: min(390px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding: 3px;
  overflow: hidden;
  border: 1px solid rgba(8, 122, 59, .42);
  border-radius: 20px;
  background: var(--pc-ppe-v5-surface, #ffffff);
  background: color-mix(in srgb, var(--pc-ppe-v5-surface, #ffffff) 94%, transparent);
  box-shadow:
    0 18px 42px rgba(9, 33, 24, .16),
    0 4px 12px rgba(8, 122, 59, .08),
    inset 0 1px 0 rgba(255, 255, 255, .92);
  color: var(--pc-ppe-v5-ink, #092118);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}
.pc-public-contact-dock[data-dialog-open='true'] {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.pc-public-contact-dock,
.pc-public-contact-dock * { box-sizing: border-box; min-width: 0; }
.pc-public-contact-dock-action {
  min-height: 54px;
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 6px 10px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color .18s ease,
    color .18s ease,
    transform .18s ease,
    box-shadow .18s ease;
}
.pc-public-contact-dock-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--pc-ppe-v5-green, #087a3b);
  background: linear-gradient(145deg, rgba(8, 122, 59, .13), rgba(8, 122, 59, .055));
  box-shadow: inset 0 0 0 1px rgba(8, 122, 59, .12);
  transition:
    background-color .18s ease,
    color .18s ease,
    transform .18s ease,
    box-shadow .18s ease;
}
.pc-public-contact-dock-icon svg { display: block; }
.pc-public-contact-dock-action strong {
  display: block;
  font-size: 12.5px;
  line-height: 1.1;
  font-weight: 720;
  letter-spacing: -.005em;
  white-space: nowrap;
}
@media (hover: hover) {
  .pc-public-contact-dock-action:hover {
    background: rgba(8, 122, 59, .07);
    transform: translateY(-1px);
  }
  .pc-public-contact-dock-action:hover .pc-public-contact-dock-icon {
    color: #ffffff;
    background: var(--pc-ppe-v5-green, #087a3b);
    box-shadow: 0 5px 12px rgba(8, 122, 59, .20);
    transform: scale(1.035);
  }
}
.pc-public-contact-dock-action:active {
  background: rgba(8, 122, 59, .11);
  transform: translateY(0) scale(.985);
}
.pc-public-contact-dock-action:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--pc-ppe-v5-green, #087a3b);
  outline-offset: -2px;
  box-shadow: 0 0 0 3px rgba(8, 122, 59, .14);
}
@media (max-width: 520px) {
  .pc-public-contact-dock {
    right: max(8px, env(safe-area-inset-right, 0px));
    left: max(8px, env(safe-area-inset-left, 0px));
    bottom: max(2px, calc(env(safe-area-inset-bottom, 0px) + 2px));
    width: auto;
    border-radius: 18px;
  }
  .pc-public-contact-dock-action {
    min-height: 52px;
    gap: 6px;
    padding-inline: 6px;
    border-radius: 13px;
  }
  .pc-public-contact-dock-icon {
    width: 28px;
    height: 28px;
    flex-basis: 28px;
    border-radius: 9px;
  }
  .pc-public-contact-dock-action strong { font-size: 11.5px; }
}
@media (max-width: 350px) {
  .pc-public-contact-dock-action { gap: 4px; padding-inline: 4px; }
  .pc-public-contact-dock-icon {
    width: 26px;
    height: 26px;
    flex-basis: 26px;
    border-radius: 8px;
  }
  .pc-public-contact-dock-icon svg { width: 17px; height: 17px; }
  .pc-public-contact-dock-action strong { font-size: 10.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-public-contact-dock-action,
  .pc-public-contact-dock-icon { transition: none; animation: none; }
}
@media (forced-colors: active) {
  .pc-public-contact-dock {
    border: 2px solid ButtonText;
    background: Canvas;
    box-shadow: none;
  }
  .pc-public-contact-dock-action { color: ButtonText; }
  .pc-public-contact-dock-icon {
    color: ButtonText;
    background: Canvas;
    box-shadow: inset 0 0 0 1px ButtonText;
  }
}
`;