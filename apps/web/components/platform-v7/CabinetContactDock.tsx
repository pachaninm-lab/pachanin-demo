'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, Phone, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import {
  getCabinetContactDockPolicy,
  type CabinetDockLocale,
} from '@/lib/platform-v7/cabinet-contact-dock-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

type Surface = 'assistant' | 'support';
type AssistantContext = 'private' | 'workspace';

type HiddenTriggerState = {
  tabIndex: string | null;
  ariaHidden: string | null;
};

const SUPPORT_PHONE_DISPLAY = '8 916 277-89-89';
const SUPPORT_PHONE_HREF = 'tel:+79162778989';

function resolveLocale(): CabinetDockLocale {
  if (typeof document === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const html = document.documentElement.lang.toLowerCase();
  if (html.startsWith('en')) return 'en';
  if (html.startsWith('zh')) return 'zh';
  return 'ru';
}

function normalizePath(pathname: string | null): string {
  return (pathname || '/platform-v7').split('?')[0].replace(/\/+$/u, '') || '/platform-v7';
}

function restoreAttribute(node: HTMLElement, name: string, value: string | null) {
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

export function CabinetContactDock({
  role,
  assistantContext = 'private',
}: {
  role: PlatformRole;
  assistantContext?: AssistantContext;
}) {
  const routePath = normalizePath(usePathname());
  const [locale, setLocale] = React.useState<CabinetDockLocale>('ru');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const assistantButtonRef = React.useRef<HTMLButtonElement>(null);
  const supportButtonRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<Surface | null>(null);
  const openStateRef = React.useRef({ assistant: false, support: false });
  const policy = getCabinetContactDockPolicy(role, locale);

  const assistantTriggerSelector = assistantContext === 'workspace' ? null : '.p7-ai-trigger';
  const assistantPanelSelector = assistantContext === 'workspace'
    ? '#p7-private-ai-assistant-workspace'
    : '#p7-private-ai-assistant-panel';

  React.useEffect(() => setLocale(resolveLocale()), []);

  React.useEffect(() => {
    const hiddenTriggers = new Map<HTMLButtonElement, HiddenTriggerState>();

    const hideTrigger = (node: HTMLButtonElement | null) => {
      if (!node || hiddenTriggers.has(node)) return;
      hiddenTriggers.set(node, {
        tabIndex: node.getAttribute('tabindex'),
        ariaHidden: node.getAttribute('aria-hidden'),
      });
      node.setAttribute('tabindex', '-1');
      node.setAttribute('aria-hidden', 'true');
    };

    const sync = () => {
      hideTrigger(assistantTriggerSelector
        ? document.querySelector<HTMLButtonElement>(assistantTriggerSelector)
        : null);
      hideTrigger(document.querySelector<HTMLButtonElement>('.p7-support-chat-button'));

      const assistantOpen = assistantContext !== 'workspace'
        && Boolean(document.querySelector(assistantPanelSelector));
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

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      for (const [node, previous] of hiddenTriggers) {
        restoreAttribute(node, 'tabindex', previous.tabIndex);
        restoreAttribute(node, 'aria-hidden', previous.ariaHidden);
      }
    };
  }, [assistantContext, assistantPanelSelector, assistantTriggerSelector]);

  const track = (action: 'assistant' | 'support' | 'call' | 'unavailable') => {
    trackEvent('cabinet_contact_dock_action', {
      action,
      cabinetRole: role,
      roleFocus: policy.roleFocus,
      supportTopic: policy.supportTopic,
      shellFamily: policy.shellFamily,
      pagePath: routePath,
      assistantContext,
    });
  };

  const openSurface = (surface: Surface) => {
    if (surface === 'assistant' && assistantContext === 'workspace') {
      const workspace = document.querySelector<HTMLElement>(assistantPanelSelector);
      if (!workspace) {
        track('unavailable');
        return;
      }
      track('assistant');
      workspace.scrollIntoView({ block: 'start', behavior: 'smooth' });
      window.requestAnimationFrame(() => workspace.focus({ preventScroll: true }));
      return;
    }

    const selector = surface === 'assistant' ? assistantTriggerSelector : '.p7-support-chat-button';
    if (!selector) return;
    const trigger = document.querySelector<HTMLButtonElement>(selector);
    if (!trigger) {
      track('unavailable');
      return;
    }

    track(surface);
    returnFocusRef.current = surface;
    trigger.click();
  };

  return (
    <nav
      className='pc-cabinet-contact-dock'
      aria-label={policy.groupLabel}
      aria-hidden={dialogOpen}
      data-dialog-open={dialogOpen ? 'true' : 'false'}
      data-assistant-context={assistantContext}
      data-cabinet-role={role}
      data-role-tone={policy.tone}
      data-shell-family={policy.shellFamily}
      data-support-topic={policy.supportTopic}
    >
      <button
        ref={assistantButtonRef}
        type='button'
        className='pc-cabinet-contact-dock-action pc-cabinet-contact-dock-assistant'
        aria-label={policy.assistantAria}
        aria-haspopup={assistantContext === 'workspace' ? undefined : 'dialog'}
        aria-controls={assistantPanelSelector.slice(1)}
        title={`${policy.roleLabel}: ${policy.roleFocus}`}
        onClick={() => openSurface('assistant')}
      >
        <span className='pc-cabinet-contact-dock-icon' aria-hidden='true'>
          <Sparkles size={18} strokeWidth={2.15} />
        </span>
        <span className='pc-cabinet-contact-dock-copy'>
          <strong>{policy.assistantLabel}</strong>
          <small>{policy.roleLabel}</small>
        </span>
      </button>

      <button
        ref={supportButtonRef}
        type='button'
        className='pc-cabinet-contact-dock-action'
        aria-label={policy.supportAria}
        aria-haspopup='dialog'
        title={`${policy.supportLabel}: ${policy.supportDomain}`}
        onClick={() => openSurface('support')}
      >
        <span className='pc-cabinet-contact-dock-icon' aria-hidden='true'>
          <MessageCircle size={18} strokeWidth={2.1} />
        </span>
        <span className='pc-cabinet-contact-dock-copy'>
          <strong>{policy.supportLabel}</strong>
          <small>{policy.supportDomain}</small>
        </span>
      </button>

      <a
        className='pc-cabinet-contact-dock-action pc-cabinet-contact-dock-call'
        href={SUPPORT_PHONE_HREF}
        aria-label={`${policy.callAria}: ${SUPPORT_PHONE_DISPLAY}`}
        title={SUPPORT_PHONE_DISPLAY}
        onClick={() => track('call')}
      >
        <span className='pc-cabinet-contact-dock-icon' aria-hidden='true'>
          <Phone size={18} strokeWidth={2.1} />
        </span>
        <span className='pc-cabinet-contact-dock-copy'>
          <strong>{policy.callLabel}</strong>
          <small>{policy.callCaption}</small>
        </span>
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
.pc-cabinet-contact-dock {
  --pc-cabinet-dock-accent: var(--ds-color-action-primary, #087a3b);
  --pc-cabinet-dock-surface: var(--ds-color-surface, #ffffff);
  --pc-cabinet-dock-text: var(--ds-color-text-primary, #092118);
  --pc-cabinet-dock-muted: var(--ds-color-text-muted, #52635b);
  position: fixed;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: max(94px, calc(env(safe-area-inset-bottom, 0px) + 90px));
  z-index: 97;
  width: min(408px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding: 3px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--pc-cabinet-dock-accent) 48%, var(--ds-color-border, #cfdcd4));
  border-radius: 19px;
  background: color-mix(in srgb, var(--pc-cabinet-dock-surface) 94%, transparent);
  box-shadow:
    0 14px 32px color-mix(in srgb, var(--pc-cabinet-dock-text) 14%, transparent),
    0 2px 8px color-mix(in srgb, var(--pc-cabinet-dock-accent) 10%, transparent),
    inset 0 1px 0 color-mix(in srgb, #ffffff 72%, transparent);
  color: var(--pc-cabinet-dock-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}
.pc-cabinet-contact-dock[data-role-tone='review'] {
  --pc-cabinet-dock-accent: var(--ds-color-information, #2563a5);
}
.pc-cabinet-contact-dock[data-role-tone='field'] {
  --pc-cabinet-dock-accent: var(--ds-color-warning, #9a5b00);
  bottom: max(100px, calc(env(safe-area-inset-bottom, 0px) + 96px));
  width: min(420px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  border-width: 2px;
}
.pc-cabinet-contact-dock[data-shell-family='operator'] {
  width: min(424px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
}
.pc-cabinet-contact-dock[data-dialog-open='true'] {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.pc-shell-root-v4 .pc-v4-main {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 172px);
}
.pc-cabinet-contact-dock,
.pc-cabinet-contact-dock * { box-sizing: border-box; min-width: 0; }
.pc-cabinet-contact-dock-action {
  min-height: 54px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 6px 8px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.pc-cabinet-contact-dock[data-role-tone='field'] .pc-cabinet-contact-dock-action {
  min-height: 58px;
}
.pc-cabinet-contact-dock-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--pc-cabinet-dock-accent);
  background: color-mix(in srgb, var(--pc-cabinet-dock-accent) 13%, var(--pc-cabinet-dock-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pc-cabinet-dock-accent) 25%, transparent);
  transition: background-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.pc-cabinet-contact-dock-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
  text-align: left;
}
.pc-cabinet-contact-dock-copy strong {
  display: block;
  overflow: hidden;
  color: var(--pc-cabinet-dock-text);
  font-size: 12px;
  line-height: 1.05;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-cabinet-contact-dock-copy small {
  display: block;
  overflow: hidden;
  color: var(--pc-cabinet-dock-muted);
  font-size: 9.5px;
  line-height: 1.05;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-cabinet-contact-dock-assistant .pc-cabinet-contact-dock-copy strong {
  color: var(--pc-cabinet-dock-accent);
  font-weight: 900;
}
@media (hover: hover) {
  .pc-cabinet-contact-dock-action:hover {
    background: color-mix(in srgb, var(--pc-cabinet-dock-accent) 9%, transparent);
    transform: translateY(-1px);
  }
  .pc-cabinet-contact-dock-action:hover .pc-cabinet-contact-dock-icon {
    color: var(--pc-cabinet-dock-surface);
    background: var(--pc-cabinet-dock-accent);
    box-shadow: 0 5px 12px color-mix(in srgb, var(--pc-cabinet-dock-accent) 24%, transparent);
    transform: scale(1.025);
  }
}
.pc-cabinet-contact-dock-action:active {
  background: color-mix(in srgb, var(--pc-cabinet-dock-accent) 13%, transparent);
  transform: translateY(0) scale(.985);
}
.pc-cabinet-contact-dock-action:focus-visible {
  position: relative;
  z-index: 1;
  outline: 3px solid var(--pc-cabinet-dock-accent);
  outline-offset: -2px;
}
@media (max-width: 520px) {
  .pc-cabinet-contact-dock,
  .pc-cabinet-contact-dock[data-shell-family='operator'],
  .pc-cabinet-contact-dock[data-role-tone='field'] {
    right: max(8px, env(safe-area-inset-right, 0px));
    left: max(8px, env(safe-area-inset-left, 0px));
    width: auto;
    border-radius: 18px;
  }
  .pc-cabinet-contact-dock-action {
    min-height: 54px;
    gap: 5px;
    padding-inline: 5px;
    border-radius: 13px;
  }
  .pc-cabinet-contact-dock[data-role-tone='field'] .pc-cabinet-contact-dock-action { min-height: 58px; }
  .pc-cabinet-contact-dock-icon {
    width: 28px;
    height: 28px;
    flex-basis: 28px;
    border-radius: 9px;
  }
  .pc-cabinet-contact-dock-copy strong { font-size: 11px; }
  .pc-cabinet-contact-dock-copy small { font-size: 9px; }
}
@media (max-width: 350px) {
  .pc-cabinet-contact-dock-action { gap: 4px; padding-inline: 3px; }
  .pc-cabinet-contact-dock-icon {
    width: 26px;
    height: 26px;
    flex-basis: 26px;
    border-radius: 8px;
  }
  .pc-cabinet-contact-dock-icon svg { width: 16px; height: 16px; }
  .pc-cabinet-contact-dock-copy strong { font-size: 10px; }
  .pc-cabinet-contact-dock-copy small { font-size: 8.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-cabinet-contact-dock-action,
  .pc-cabinet-contact-dock-icon { transition: none; animation: none; }
}
@media (forced-colors: active) {
  .pc-cabinet-contact-dock {
    border: 2px solid ButtonText;
    background: Canvas;
    box-shadow: none;
  }
  .pc-cabinet-contact-dock-action,
  .pc-cabinet-contact-dock-copy strong,
  .pc-cabinet-contact-dock-copy small { color: ButtonText; }
  .pc-cabinet-contact-dock-icon {
    color: ButtonText;
    background: Canvas;
    box-shadow: inset 0 0 0 1px ButtonText;
  }
}
`;
