'use client';

import * as React from 'react';
import { PUBLIC_STREAM_TIMEOUT_MS } from '@/lib/platform-v7/ai-gateway-stream';

type Locale = 'ru' | 'en' | 'zh';

type SheetConfig = {
  panelSelector: string;
  headerSelector: string;
  closeSelector: string;
  scrollSelector: string;
};

const SUPPORT_SHEETS: SheetConfig[] = [
  {
    panelSelector: '.p7-support-chat-panel',
    headerSelector: '.p7-support-chat-head',
    closeSelector: '.p7-support-chat-head button[aria-label]',
    scrollSelector: '.p7-support-chat-form, .p7-support-chat-success',
  },
];

const LABELS: Record<Locale, { expand: string; collapse: string }> = {
  ru: { expand: 'На весь экран', collapse: 'Свернуть окно' },
  en: { expand: 'Enter full screen', collapse: 'Exit full screen' },
  zh: { expand: '全屏显示', collapse: '退出全屏' },
};

const PUBLIC_ASSISTANT_BRANDING: Record<Locale, { title: string; subtitle: string }> = {
  ru: { title: 'ИИ для агробизнеса', subtitle: 'Разработан Прозрачной ценой для сельского хозяйства.' },
  en: { title: 'AI for agribusiness', subtitle: 'Developed by Transparent Price for agriculture.' },
  zh: { title: '农业商业人工智能', subtitle: '由“透明价格”为农业打造。' },
};

const PUBLIC_ASSISTANT_TIMEOUT_COPY: Record<Locale, { message: string; retry: string }> = {
  ru: { message: 'Ответ не завершён. Повтори последний запрос.', retry: 'Повторить запрос' },
  en: { message: 'The answer did not finish. Retry the last request.', retry: 'Retry request' },
  zh: { message: '回答未完成。请重试上一个问题。', retry: '重试问题' },
};

const PUBLIC_ASSISTANT_RESET_COPY: Record<Locale, string> = {
  ru: 'Новый диалог',
  en: 'New conversation',
  zh: '新对话',
};

const PUBLIC_ASSISTANT_TIMEOUT_MS = PUBLIC_STREAM_TIMEOUT_MS;
const PUBLIC_ASSISTANT_IDENTITY_STYLE_ID = 'pc-public-assistant-identity-branding-v2';
const INTERNAL_ARTIFACT_PATTERN = /(?:<\/?(?:think|analysis|reasoning)\b|tool[_ -]?calls?|tool[_ -]?trace|think-state|reasoning[_ -]?state|"(?:arguments|tool_call_id)"\s*:)/iu;

const PUBLIC_ASSISTANT_IDENTITY_CSS = `
.pc-public-assistant-panel .pc-public-assistant-header {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) 44px 44px !important;
  align-items: center !important;
  column-gap: 8px !important;
  min-height: 68px !important;
  padding: 8px 10px 8px 12px !important;
  overflow: hidden !important;
}
.pc-public-assistant-panel .pc-public-assistant-identity {
  display: grid !important;
  grid-template-columns: 42px minmax(0, 1fr) !important;
  align-items: center !important;
  gap: 10px !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
}
.pc-public-assistant-panel .pc-public-assistant-identity > .pc-public-assistant-mark {
  position: static !important;
  display: inline-flex !important;
  visibility: visible !important;
  flex: 0 0 42px !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  min-height: 42px !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  border: 1px solid #c7ddd0 !important;
  border-radius: 11px !important;
  background: #f3faf6 !important;
  color: #087a3b !important;
  opacity: 1 !important;
  transform: none !important;
}
.pc-public-assistant-panel .pc-public-assistant-identity > .pc-public-assistant-mark svg {
  display: block !important;
  width: 21px !important;
  height: 21px !important;
  stroke-width: 2 !important;
}
.pc-public-assistant-panel .pc-public-assistant-identity > .pc-public-assistant-identity-copy {
  display: grid !important;
  min-width: 0 !important;
  max-width: 100% !important;
  gap: 3px !important;
  overflow: hidden !important;
}
.pc-public-assistant-panel #pc-public-assistant-title {
  display: block !important;
  max-width: 100% !important;
  overflow: hidden !important;
  color: #092118 !important;
  font-size: clamp(15px, 4vw, 17px) !important;
  font-weight: 750 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.02em !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.pc-public-assistant-panel .pc-public-assistant-identity [data-pc-public-assistant-subtitle='true'] {
  display: -webkit-box !important;
  max-width: 100% !important;
  overflow: hidden !important;
  color: #2f7d5a !important;
  font-size: 9px !important;
  font-weight: 600 !important;
  line-height: 1.18 !important;
  letter-spacing: 0 !important;
  white-space: normal !important;
  text-overflow: clip !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
}
.pc-public-assistant-panel .pc-public-assistant-header-action {
  display: none !important;
}
.pc-public-assistant-panel .pc-public-assistant-reset-proxy {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  align-self: flex-start !important;
  width: max-content !important;
  max-width: calc(100% - 24px) !important;
  min-height: 32px !important;
  margin: 6px 12px 0 !important;
  padding: 6px 11px !important;
  border: 1px solid #d2e2d8 !important;
  border-radius: 999px !important;
  background: #f5faf7 !important;
  color: #07572e !important;
  font: inherit !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  cursor: pointer !important;
}
.pc-public-assistant-panel .pc-public-assistant-reset-proxy:focus-visible {
  outline: 2px solid #087a3b !important;
  outline-offset: 2px !important;
}
.pc-public-assistant-panel .pc-public-assistant-header > .pc-public-assistant-icon-button {
  display: inline-flex !important;
  flex: 0 0 44px !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  min-height: 44px !important;
  margin: 0 !important;
}
@media (max-width: 430px) {
  .pc-public-assistant-panel .pc-public-assistant-header {
    grid-template-columns: minmax(0, 1fr) 42px 42px !important;
    column-gap: 6px !important;
    min-height: 70px !important;
    padding: 7px 8px 7px 10px !important;
  }
  .pc-public-assistant-panel .pc-public-assistant-identity {
    grid-template-columns: 40px minmax(0, 1fr) !important;
    gap: 8px !important;
  }
  .pc-public-assistant-panel .pc-public-assistant-identity > .pc-public-assistant-mark {
    flex-basis: 40px !important;
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
  }
  .pc-public-assistant-panel #pc-public-assistant-title {
    font-size: 15px !important;
  }
  .pc-public-assistant-panel .pc-public-assistant-identity [data-pc-public-assistant-subtitle='true'] {
    font-size: 8.5px !important;
    line-height: 1.16 !important;
  }
  .pc-public-assistant-panel .pc-public-assistant-header > .pc-public-assistant-icon-button {
    flex-basis: 42px !important;
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    min-height: 42px !important;
  }
}
`;

function resolveLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const lang = document.documentElement.lang.toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('zh')) return 'zh';
  return 'ru';
}

function updateButton(button: HTMLButtonElement, expanded: boolean) {
  const copy = LABELS[resolveLocale()];
  const label = expanded ? copy.collapse : copy.expand;
  button.dataset.expanded = String(expanded);
  button.setAttribute('aria-pressed', String(expanded));
  button.setAttribute('aria-label', label);
  button.title = label;
}

function alignLatestAssistantAnswer(panel: HTMLElement) {
  const scrollHost = panel.querySelector<HTMLElement>('.pc-public-assistant-messages');
  if (!scrollHost) return () => undefined;

  let timer = 0;
  let latestAligned: HTMLElement | null = null;

  const align = () => {
    const answers = scrollHost.querySelectorAll<HTMLElement>(".pc-public-assistant-message[data-role='assistant']");
    const latest = answers.item(answers.length - 1);
    if (!latest || latest === latestAligned || !latest.querySelector('.pc-public-assistant-answer')) return;
    latestAligned = latest;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const top = Math.max(0, latest.offsetTop - 8);
      scrollHost.scrollTo({ top, behavior: 'smooth' });
    }, 120);
  };

  const observer = new MutationObserver(align);
  observer.observe(scrollHost, { childList: true, subtree: true });
  align();

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}

function setControlledTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(textarea, value);
  else textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function ensurePublicAssistantIdentityStyle() {
  if (document.getElementById(PUBLIC_ASSISTANT_IDENTITY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PUBLIC_ASSISTANT_IDENTITY_STYLE_ID;
  style.textContent = PUBLIC_ASSISTANT_IDENTITY_CSS;
  document.head.append(style);
}

function enforcePublicAssistantIdentity(panel: HTMLElement) {
  ensurePublicAssistantIdentityStyle();

  const identity = panel.querySelector<HTMLElement>('.pc-public-assistant-identity');
  const mark = identity?.querySelector<HTMLElement>('.pc-public-assistant-mark');
  const title = identity?.querySelector<HTMLElement>('#pc-public-assistant-title');
  const textGroup = title?.parentElement;
  const subtitle = textGroup?.querySelector<HTMLElement>(':scope > span');
  if (!identity || !mark || !title || !textGroup || !subtitle) return;

  for (const child of Array.from(identity.children)) {
    if (child !== mark && child !== textGroup) child.remove();
  }
  for (const child of Array.from(textGroup.children)) {
    if (child !== title && child !== subtitle) child.remove();
  }
  for (const node of Array.from(textGroup.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) node.remove();
  }

  identity.dataset.pcPublicAssistantIdentity = 'two-lines-only';
  mark.dataset.pcPublicAssistantAiMark = 'true';
  textGroup.className = 'pc-public-assistant-identity-copy';
  subtitle.dataset.pcPublicAssistantSubtitle = 'true';
}

function enhancePublicAssistant(panel: HTMLElement) {
  if (panel.dataset.pcPublicAssistantSafetyEnhanced === 'true') return () => undefined;
  panel.dataset.pcPublicAssistantSafetyEnhanced = 'true';

  let watchdogTimer = 0;
  let timedOut = false;
  let busyPreviously = false;
  let syncing = false;
  let resetProxy: HTMLButtonElement | null = null;

  const clearWatchdogTimer = () => {
    window.clearTimeout(watchdogTimer);
    watchdogTimer = 0;
  };

  const removeWatchdogError = () => {
    panel.querySelector<HTMLElement>('[data-pc-public-assistant-watchdog-error]')?.remove();
  };

  const clearTimeoutState = () => {
    timedOut = false;
    delete panel.dataset.pcPublicAssistantTimedOut;
    removeWatchdogError();
  };

  const retryLastQuestion = () => {
    const questions = panel.querySelectorAll<HTMLElement>(".pc-public-assistant-message[data-role='user'] .pc-public-assistant-bubble p");
    const question = questions.item(questions.length - 1)?.textContent?.trim() || '';
    const textarea = panel.querySelector<HTMLTextAreaElement>('.pc-public-assistant-composer textarea');
    const form = panel.querySelector<HTMLFormElement>('.pc-public-assistant-composer');
    if (!question || !textarea || !form) return;

    clearTimeoutState();
    setControlledTextareaValue(textarea, question);
    window.setTimeout(() => form.requestSubmit(), 0);
  };

  const ensureWatchdogError = () => {
    if (!timedOut || panel.querySelector('[data-pc-public-assistant-watchdog-error]')) return;
    const form = panel.querySelector<HTMLFormElement>('.pc-public-assistant-composer');
    if (!form) return;

    const copy = PUBLIC_ASSISTANT_TIMEOUT_COPY[resolveLocale()];
    const alert = document.createElement('div');
    alert.dataset.pcPublicAssistantWatchdogError = 'true';
    alert.setAttribute('role', 'alert');
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.justifyContent = 'space-between';
    alert.style.gap = '10px';
    alert.style.padding = '9px 12px';
    alert.style.borderTop = '1px solid #d8e3dc';
    alert.style.background = '#fff8f5';
    alert.style.color = '#6f2f21';
    alert.style.fontSize = '12px';
    alert.style.lineHeight = '1.35';

    const message = document.createElement('span');
    message.textContent = copy.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = copy.retry;
    retry.style.flex = '0 0 auto';
    retry.style.minHeight = '36px';
    retry.style.padding = '7px 10px';
    retry.style.border = '1px solid #cfdcd4';
    retry.style.borderRadius = '9px';
    retry.style.background = '#ffffff';
    retry.style.color = '#07572e';
    retry.style.font = 'inherit';
    retry.style.fontWeight = '700';
    retry.style.cursor = 'pointer';
    retry.addEventListener('click', retryLastQuestion);

    alert.append(message, retry);
    form.before(alert);
  };

  const stopActiveRequest = () => {
    const stop = panel.querySelector<HTMLButtonElement>(".pc-public-assistant-composer-button[data-kind='stop']");
    stop?.click();
  };

  const onResetProxyClick = () => {
    panel.querySelector<HTMLButtonElement>('.pc-public-assistant-header-action')?.click();
  };

  const removeResetProxy = () => {
    if (!resetProxy) return;
    resetProxy.removeEventListener('click', onResetProxyClick);
    resetProxy.remove();
    resetProxy = null;
  };

  const syncResetProxy = () => {
    const nativeReset = panel.querySelector<HTMLButtonElement>('.pc-public-assistant-header-action');
    const form = panel.querySelector<HTMLFormElement>('.pc-public-assistant-composer');
    if (!nativeReset || !form) {
      removeResetProxy();
      return;
    }

    const label = PUBLIC_ASSISTANT_RESET_COPY[resolveLocale()];
    if (!resetProxy) {
      resetProxy = document.createElement('button');
      resetProxy.type = 'button';
      resetProxy.className = 'pc-public-assistant-reset-proxy';
      resetProxy.dataset.pcPublicAssistantResetProxy = 'true';
      resetProxy.addEventListener('click', onResetProxyClick);
    }
    if (resetProxy.textContent !== label) resetProxy.textContent = label;
    resetProxy.setAttribute('aria-label', label);
    resetProxy.title = label;
    if (resetProxy.nextElementSibling !== form) form.before(resetProxy);
  };

  const onWatchdogTimeout = () => {
    const messages = panel.querySelector<HTMLElement>('.pc-public-assistant-messages');
    if (messages?.getAttribute('aria-busy') !== 'true') return;
    timedOut = true;
    panel.dataset.pcPublicAssistantTimedOut = 'true';
    stopActiveRequest();
    ensureWatchdogError();
  };

  const scrubPublicUi = () => {
    enforcePublicAssistantIdentity(panel);
    const identity = panel.querySelector<HTMLElement>('.pc-public-assistant-identity');
    const title = identity?.querySelector<HTMLElement>('#pc-public-assistant-title');
    const subtitle = identity?.querySelector<HTMLElement>("[data-pc-public-assistant-subtitle='true']");
    const copy = PUBLIC_ASSISTANT_BRANDING[resolveLocale()];
    if (title && title.textContent !== copy.title) title.textContent = copy.title;
    if (subtitle && subtitle.textContent !== copy.subtitle) subtitle.textContent = copy.subtitle;

    for (const duplicate of panel.querySelectorAll<HTMLElement>('.pc-modal-sheet-fullscreen-button')) duplicate.remove();

    const header = panel.querySelector<HTMLElement>('.pc-public-assistant-header');
    const iconButtons = header
      ? Array.from(header.querySelectorAll<HTMLButtonElement>(':scope > .pc-public-assistant-icon-button'))
      : [];
    if (iconButtons.length > 2) {
      for (const duplicate of iconButtons.slice(1, -1)) duplicate.remove();
    }
    iconButtons[0]?.setAttribute('data-pc-public-assistant-fullscreen', 'native');
    syncResetProxy();

    for (const article of panel.querySelectorAll<HTMLElement>(".pc-public-assistant-message[data-role='assistant']")) {
      article.removeAttribute('data-model-identity');
      const streaming = article.dataset.streamStatus === 'streaming';
      const bubble = article.querySelector<HTMLElement>('.pc-public-assistant-bubble');
      if (bubble) {
        const raw = bubble.textContent || '';
        bubble.hidden = streaming || INTERNAL_ARTIFACT_PATTERN.test(raw);
      }
      const details = article.querySelector<HTMLDetailsElement>('.pc-public-assistant-details');
      if (details && article.hasAttribute('data-stream-status')) details.hidden = true;
      article.querySelector<HTMLElement>('.pc-public-assistant-model')?.remove();
      for (const paragraph of article.querySelectorAll<HTMLParagraphElement>('.pc-public-assistant-details-body > p')) {
        if (/^[A-Z][A-Z0-9_]*(?:\s*·\s*[A-Z][A-Z0-9_]*)*$/u.test(paragraph.textContent?.trim() || '')) paragraph.remove();
      }
    }
  };

  const syncBusyState = () => {
    const messages = panel.querySelector<HTMLElement>('.pc-public-assistant-messages');
    const busy = messages?.getAttribute('aria-busy') === 'true';

    if (busy && !busyPreviously) {
      clearTimeoutState();
      clearWatchdogTimer();
      watchdogTimer = window.setTimeout(onWatchdogTimeout, PUBLIC_ASSISTANT_TIMEOUT_MS);
    } else if (!busy) {
      clearWatchdogTimer();
    }
    busyPreviously = busy;
  };

  const sync = () => {
    if (syncing) return;
    syncing = true;
    try {
      scrubPublicUi();
      syncBusyState();
      ensureWatchdogError();
    } finally {
      syncing = false;
    }
  };

  const onCloseCapture = () => {
    stopActiveRequest();
    clearWatchdogTimer();
  };
  const onEscapeCapture = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && panel.dataset.fullscreen !== 'true') onCloseCapture();
  };
  const onSubmitCapture = () => clearTimeoutState();

  const observer = new MutationObserver(sync);
  observer.observe(panel, { attributes: true, attributeFilter: ['aria-busy', 'data-stream-status'], childList: true, subtree: true });

  const close = panel.querySelector<HTMLButtonElement>('.pc-public-assistant-header > .pc-public-assistant-icon-button:last-child');
  close?.addEventListener('click', onCloseCapture, { capture: true });
  const backdrop = panel.previousElementSibling?.classList.contains('pc-public-assistant-backdrop')
    ? panel.previousElementSibling as HTMLButtonElement
    : null;
  backdrop?.addEventListener('click', onCloseCapture, { capture: true });
  document.addEventListener('keydown', onEscapeCapture, { capture: true });
  const form = panel.querySelector<HTMLFormElement>('.pc-public-assistant-composer');
  form?.addEventListener('submit', onSubmitCapture, { capture: true });

  const cleanupAlignment = alignLatestAssistantAnswer(panel);
  sync();

  return () => {
    stopActiveRequest();
    observer.disconnect();
    clearWatchdogTimer();
    cleanupAlignment();
    close?.removeEventListener('click', onCloseCapture, { capture: true });
    backdrop?.removeEventListener('click', onCloseCapture, { capture: true });
    document.removeEventListener('keydown', onEscapeCapture, { capture: true });
    form?.removeEventListener('submit', onSubmitCapture, { capture: true });
    removeResetProxy();
    removeWatchdogError();
    delete panel.dataset.pcPublicAssistantSafetyEnhanced;
    delete panel.dataset.pcPublicAssistantTimedOut;
  };
}

function enhanceSupportSheet(panel: HTMLElement, config: SheetConfig) {
  if (panel.dataset.pcFullscreenEnhanced === 'true') return () => undefined;

  const header = panel.querySelector<HTMLElement>(config.headerSelector);
  const close = panel.querySelector<HTMLButtonElement>(config.closeSelector);
  if (!header || !close) return () => undefined;

  panel.dataset.pcFullscreenEnhanced = 'true';
  panel.dataset.pcFullscreen = 'false';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pc-modal-sheet-fullscreen-button';
  updateButton(button, false);

  const onToggle = () => {
    const scrollHost = panel.querySelector<HTMLElement>(config.scrollSelector);
    const scrollTop = scrollHost?.scrollTop ?? 0;
    const expanded = panel.dataset.pcFullscreen !== 'true';
    panel.dataset.pcFullscreen = String(expanded);
    updateButton(button, expanded);

    window.requestAnimationFrame(() => {
      if (scrollHost) scrollHost.scrollTop = scrollTop;
      button.focus({ preventScroll: true });
    });
  };

  button.addEventListener('click', onToggle);
  header.insertBefore(button, close);

  return () => {
    button.removeEventListener('click', onToggle);
    button.remove();
    delete panel.dataset.pcFullscreen;
    delete panel.dataset.pcFullscreenEnhanced;
  };
}

export function UnifiedModalSheetFullscreenController() {
  React.useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const scan = () => {
      for (const panel of document.querySelectorAll<HTMLElement>('.pc-public-assistant-panel')) {
        if (!cleanups.has(panel)) cleanups.set(panel, enhancePublicAssistant(panel));
      }

      for (const config of SUPPORT_SHEETS) {
        for (const panel of document.querySelectorAll<HTMLElement>(config.panelSelector)) {
          if (!cleanups.has(panel)) cleanups.set(panel, enhanceSupportSheet(panel, config));
        }
      }

      for (const [panel, cleanup] of cleanups) {
        if (!panel.isConnected) {
          cleanup();
          cleanups.delete(panel);
        }
      }
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      observer.disconnect();
      for (const cleanup of cleanups.values()) cleanup();
      cleanups.clear();
    };
  }, []);

  return null;
}
