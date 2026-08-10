'use client';

import * as React from 'react';
import { HelpCircle, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Surface = 'assistant' | 'support';
type AssistantContext = 'public' | 'private' | 'workspace';
type Presentation = 'full' | 'compact-help';

const SUPPORT_PHONE_DISPLAY = '8 916 277-89-89';
const SUPPORT_PHONE_HREF = 'tel:+79162778989';
const PUBLIC_MOBILE_QUERY = '(max-width: 767px)';
const PUBLIC_HERO_THRESHOLD = 120;

const COPY = {
  ru: {
    assistant: 'ИИ',
    assistantAria: 'Открыть ИИ-помощника по платформе',
    support: 'Поддержка',
    supportAria: 'Открыть поддержку',
    call: 'Позвонить',
    callAria: `Позвонить по номеру ${SUPPORT_PHONE_DISPLAY}`,
    group: 'Связь и помощь',
    help: 'Помощь',
    helpAria: 'Открыть способы помощи',
  },
  en: {
    assistant: 'AI',
    assistantAria: 'Open the platform AI assistant',
    support: 'Support',
    supportAria: 'Open support',
    call: 'Call',
    callAria: `Call ${SUPPORT_PHONE_DISPLAY}`,
    group: 'Help and contact',
    help: 'Help',
    helpAria: 'Open help options',
  },
  zh: {
    assistant: 'AI 助手',
    assistantAria: '打开平台 AI 助手',
    support: '支持',
    supportAria: '打开支持',
    call: '致电',
    callAria: `拨打 ${SUPPORT_PHONE_DISPLAY}`,
    group: '帮助与联系',
    help: '帮助',
    helpAria: '打开帮助选项',
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

export function PublicContactDock({
  assistantContext = 'public',
  presentation = 'full',
}: {
  assistantContext?: AssistantContext;
  presentation?: Presentation;
}) {
  const [locale, setLocale] = React.useState<Locale>('ru');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [hiddenByScroll, setHiddenByScroll] = React.useState(assistantContext === 'public');
  const [helpOpen, setHelpOpen] = React.useState(false);
  const dockRef = React.useRef<HTMLElement>(null);
  const helpButtonRef = React.useRef<HTMLButtonElement>(null);
  const assistantButtonRef = React.useRef<HTMLButtonElement>(null);
  const supportButtonRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<Surface | null>(null);
  const openStateRef = React.useRef({ assistant: false, support: false });
  const ui = COPY[locale];
  const compact = presentation === 'compact-help';
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
    const mobileQuery = window.matchMedia(PUBLIC_MOBILE_QUERY);
    let previousY = window.scrollY;
    let accumulatedDelta = 0;
    let frame = 0;

    const isPublicMobileTop = (scrollY: number) => (
      assistantContext === 'public'
      && mobileQuery.matches
      && scrollY < PUBLIC_HERO_THRESHOLD
    );

    const syncViewportVisibility = () => {
      const currentY = window.scrollY;
      if (currentY < PUBLIC_HERO_THRESHOLD) {
        setHiddenByScroll(isPublicMobileTop(currentY));
      } else if (!mobileQuery.matches) {
        setHiddenByScroll(false);
      }
      previousY = currentY;
      accumulatedDelta = 0;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - previousY;
        if ((delta > 0 && accumulatedDelta < 0) || (delta < 0 && accumulatedDelta > 0)) accumulatedDelta = 0;
        accumulatedDelta += delta;

        if (currentY < PUBLIC_HERO_THRESHOLD) {
          setHiddenByScroll(isPublicMobileTop(currentY));
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

    syncViewportVisibility();
    mobileQuery.addEventListener('change', syncViewportVisibility);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mobileQuery.removeEventListener('change', syncViewportVisibility);
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [assistantContext]);

  React.useEffect(() => {
    const hiddenTriggers = new Map<HTMLButtonElement, { tabIndex: string | null; ariaHidden: string | null }>();

    const syncTriggers = () => {
      const candidates = [
        assistantTriggerSelector ? document.querySelector<HTMLButtonElement>(assistantTriggerSelector) : null,
        document.querySelector<HTMLButtonElement>('.p7-support-chat-button'),
      ].filter((node): node is HTMLButtonElement => Boolean(node));

      for (const node of candidates) {
        if (!hiddenTriggers.has(node)) {
          hiddenTriggers.set(node, {
            tabIndex: node.getAttribute('tabindex'),
            ariaHidden: node.getAttribute('aria-hidden'),
          });
        }
        node.setAttribute('tabindex', '-1');
        node.setAttribute('aria-hidden', 'true');
      }
    };

    const syncOpenState = () => {
      syncTriggers();
      const assistantOpen = assistantContext !== 'workspace' && Boolean(document.querySelector(assistantPanelSelector));
      const supportOpen = Boolean(document.querySelector('.p7-support-chat-panel'));
      const blockingModalOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
      const previousOpen = openStateRef.current;
      const focusTarget = returnFocusRef.current;
      const nextDialogOpen = assistantOpen || supportOpen || blockingModalOpen;

      setDialogOpen(nextDialogOpen);
      if (nextDialogOpen) setHelpOpen(false);

      if (previousOpen.assistant && !assistantOpen && focusTarget === 'assistant') {
        returnFocusRef.current = null;
        window.requestAnimationFrame(() => (compact ? helpButtonRef.current : assistantButtonRef.current)?.focus());
      }
      if (previousOpen.support && !supportOpen && focusTarget === 'support') {
        returnFocusRef.current = null;
        window.requestAnimationFrame(() => (compact ? helpButtonRef.current : supportButtonRef.current)?.focus());
      }
      openStateRef.current = { assistant: assistantOpen, support: supportOpen };
    };

    syncOpenState();
    const observer = new MutationObserver(syncOpenState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const [node, previous] of hiddenTriggers) {
        restoreAttribute(node, 'tabindex', previous.tabIndex);
        restoreAttribute(node, 'aria-hidden', previous.ariaHidden);
      }
    };
  }, [assistantContext, assistantPanelSelector, assistantTriggerSelector, compact]);

  React.useEffect(() => {
    if (!compact || !helpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setHelpOpen(false);
      window.requestAnimationFrame(() => helpButtonRef.current?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && dockRef.current?.contains(target)) return;
      setHelpOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [compact, helpOpen]);

  const openSurface = (surface: Surface) => {
    setHiddenByScroll(false);
    setHelpOpen(false);
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

  // Public landing access is unconditional: scroll behavior must never hide or disable the entry point.
  const scrollHidden = assistantContext === 'public' ? false : hiddenByScroll;
  const hidden = dialogOpen || scrollHidden;

  const actions = (
    <>
      <button
        ref={assistantButtonRef}
        type='button'
        disabled={hidden}
        tabIndex={hidden ? -1 : 0}
        className='pc-public-contact-dock-action pc-public-contact-dock-assistant'
        aria-label={ui.assistantAria}
        aria-haspopup={assistantContext === 'workspace' ? undefined : 'dialog'}
        aria-controls={assistantPanelSelector.slice(1)}
        onClick={() => openSurface('assistant')}
      >
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><Sparkles size={17} strokeWidth={2.15} /></span>
        <strong>{ui.assistant}</strong>
      </button>
      <button
        ref={supportButtonRef}
        type='button'
        disabled={hidden}
        tabIndex={hidden ? -1 : 0}
        className='pc-public-contact-dock-action'
        aria-label={ui.supportAria}
        aria-haspopup='dialog'
        onClick={() => openSurface('support')}
      >
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><MessageCircle size={17} strokeWidth={2.1} /></span>
        <strong>{ui.support}</strong>
      </button>
      <a
        className='pc-public-contact-dock-action pc-public-contact-dock-call'
        tabIndex={hidden ? -1 : 0}
        href={SUPPORT_PHONE_HREF}
        aria-label={ui.callAria}
        onClick={() => {
          setHelpOpen(false);
          trackEvent('public_support_phone_clicked', { source: compact ? 'deal_explorer_help' : 'unified_contact_dock', assistantContext });
        }}
      >
        <span className='pc-public-contact-dock-icon' aria-hidden='true'><Phone size={17} strokeWidth={2.1} /></span>
        <strong>{ui.call}</strong>
      </a>
    </>
  );

  return (
    <nav
      ref={dockRef}
      className={`pc-public-contact-dock${compact ? ' pc-public-contact-dock-compact' : ''}`}
      aria-label={ui.group}
      aria-hidden={hidden ? 'true' : undefined}
      data-dialog-open={dialogOpen ? 'true' : 'false'}
      data-scroll-hidden={scrollHidden ? 'true' : 'false'}
      data-assistant-context={assistantContext}
      data-presentation={presentation}
    >
      {compact ? (
        <>
          <button
            ref={helpButtonRef}
            type='button'
            className='pc-public-contact-dock-help'
            aria-label={ui.helpAria}
            aria-expanded={helpOpen}
            aria-controls='pc-public-contact-dock-help-menu'
            disabled={hidden}
            onClick={() => setHelpOpen((open) => !open)}
          >
            <HelpCircle size={18} strokeWidth={2.15} aria-hidden='true' />
            <strong>{ui.help}</strong>
          </button>
          <div id='pc-public-contact-dock-help-menu' className='pc-public-contact-dock-help-menu' hidden={!helpOpen}>
            {actions}
          </div>
        </>
      ) : actions}
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
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
.pc-public-contact-dock-action:disabled,
.pc-public-contact-dock-help:disabled {
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
.pc-public-contact-dock-compact {
  width: auto;
  display: block;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.pc-public-contact-dock-help {
  min-width: 116px;
  min-height: 48px;
  padding: 0 15px;
  border: 1px solid rgba(8, 122, 59, .42);
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, var(--pc-ppe-v5-surface, #ffffff) 97%, transparent);
  color: var(--pc-ppe-v5-green-dark, #07572e);
  box-shadow: 0 10px 24px rgba(9, 33, 24, .11), 0 2px 8px rgba(8, 122, 59, .05);
  font: inherit;
  font-size: 13px;
  font-weight: 780;
  cursor: pointer;
  touch-action: manipulation;
  backdrop-filter: blur(14px) saturate(125%);
  -webkit-backdrop-filter: blur(14px) saturate(125%);
}
.pc-public-contact-dock-help-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: min(304px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid rgba(8, 122, 59, .42);
  border-radius: 15px;
  background: color-mix(in srgb, var(--pc-ppe-v5-surface, #ffffff) 97%, transparent);
  box-shadow: 0 14px 32px rgba(9, 33, 24, .14), inset 0 1px 0 rgba(255, 255, 255, .94);
  backdrop-filter: blur(16px) saturate(125%);
  -webkit-backdrop-filter: blur(16px) saturate(125%);
}
.pc-public-contact-dock-help-menu[hidden] { display: none; }
.pc-public-contact-dock-help:focus-visible,
.pc-public-contact-dock-action:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--pc-ppe-v5-green, #087a3b); outline-offset: 2px; box-shadow: 0 0 0 3px rgba(8, 122, 59, .14); }
@media (hover: hover) {
  .pc-public-contact-dock-action:hover:not(:disabled) { background: rgba(8, 122, 59, .065); transform: translateY(-1px); }
  .pc-public-contact-dock-action:hover:not(:disabled) .pc-public-contact-dock-icon { color: #ffffff; background: var(--pc-ppe-v5-green, #087a3b); box-shadow: 0 4px 10px rgba(8, 122, 59, .18); }
  .pc-public-contact-dock-help:hover:not(:disabled) { background: #ffffff; box-shadow: 0 12px 28px rgba(9, 33, 24, .14); transform: translateY(-1px); }
}
.pc-public-contact-dock-action:active,
.pc-public-contact-dock-help:active { transform: translateY(0) scale(.985); }
@media (max-width: 350px) {
  .pc-public-contact-dock:not(.pc-public-contact-dock-compact) { right: max(8px, env(safe-area-inset-right, 0px)); width: min(304px, calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); }
  .pc-public-contact-dock-action { gap: 4px; padding-inline: 3px; }
  .pc-public-contact-dock-icon { width: 24px; height: 24px; flex-basis: 24px; }
  .pc-public-contact-dock-icon svg { width: 16px; height: 16px; }
  .pc-public-contact-dock-action strong { font-size: 10.5px; }
  .pc-public-contact-dock-help-menu { width: min(296px, calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); }
}
@media (prefers-reduced-motion: reduce) {
  .pc-public-contact-dock,
  .pc-public-contact-dock-action,
  .pc-public-contact-dock-icon,
  .pc-public-contact-dock-help { transition: none; animation: none; }
}
@media (forced-colors: active) {
  .pc-public-contact-dock:not(.pc-public-contact-dock-compact),
  .pc-public-contact-dock-help,
  .pc-public-contact-dock-help-menu { border: 2px solid ButtonText; background: Canvas; box-shadow: none; }
  .pc-public-contact-dock-action,
  .pc-public-contact-dock-assistant strong,
  .pc-public-contact-dock-help { color: ButtonText; }
  .pc-public-contact-dock-icon,
  .pc-public-contact-dock-assistant .pc-public-contact-dock-icon { color: ButtonText; background: Canvas; box-shadow: inset 0 0 0 1px ButtonText; }
}
`;
