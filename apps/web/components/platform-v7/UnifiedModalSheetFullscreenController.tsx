'use client';

import * as React from 'react';

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
  ru: { title: 'ИИ в агробизнесе', subtitle: 'разработан Прозрачной Ценой' },
  en: { title: 'AI for agribusiness', subtitle: 'developed by Transparent Price' },
  zh: { title: '农业商业人工智能', subtitle: '由“透明价格”开发' },
};

const PUBLIC_ASSISTANT_TIMEOUT_COPY: Record<Locale, { message: string; retry: string }> = {
  ru: { message: 'Ответ не завершён. Повтори последний запрос.', retry: 'Повторить запрос' },
  en: { message: 'The answer did not finish. Retry the last request.', retry: 'Retry request' },
  zh: { message: '回答未完成。请重试上一个问题。', retry: '重试问题' },
};

const PUBLIC_ASSISTANT_TIMEOUT_MS = 45_000;
const INTERNAL_ARTIFACT_PATTERN = /(?:<\/?(?:think|analysis|reasoning)\b|tool[_ -]?calls?|tool[_ -]?trace|think-state|reasoning[_ -]?state|"(?:arguments|tool_call_id)"\s*:)/iu;

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

function enhancePublicAssistant(panel: HTMLElement) {
  if (panel.dataset.pcPublicAssistantSafetyEnhanced === 'true') return () => undefined;
  panel.dataset.pcPublicAssistantSafetyEnhanced = 'true';

  let watchdogTimer = 0;
  let timedOut = false;
  let busyPreviously = false;
  let syncing = false;

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

  const onWatchdogTimeout = () => {
    const messages = panel.querySelector<HTMLElement>('.pc-public-assistant-messages');
    if (messages?.getAttribute('aria-busy') !== 'true') return;
    timedOut = true;
    panel.dataset.pcPublicAssistantTimedOut = 'true';
    stopActiveRequest();
    ensureWatchdogError();
  };

  const scrubPublicUi = () => {
    const identity = panel.querySelector<HTMLElement>('.pc-public-assistant-identity');
    const title = identity?.querySelector<HTMLElement>('#pc-public-assistant-title');
    const subtitle = identity?.querySelector<HTMLElement>('div > span');
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
