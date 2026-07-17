'use client';

import * as React from 'react';

type Locale = 'ru' | 'en' | 'zh';

type SheetConfig = {
  panelSelector: string;
  headerSelector: string;
  closeSelector: string;
  scrollSelector: string;
  alignAnswers?: boolean;
};

const SHEETS: SheetConfig[] = [
  {
    panelSelector: '.pc-public-assistant-panel',
    headerSelector: '.pc-public-assistant-header',
    closeSelector: '.pc-public-assistant-icon-button',
    scrollSelector: '.pc-public-assistant-messages',
    alignAnswers: true,
  },
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

function enhanceSheet(panel: HTMLElement, config: SheetConfig) {
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
  const cleanupAnswerAlignment = config.alignAnswers ? alignLatestAssistantAnswer(panel) : () => undefined;

  return () => {
    cleanupAnswerAlignment();
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
      for (const config of SHEETS) {
        for (const panel of document.querySelectorAll<HTMLElement>(config.panelSelector)) {
          if (!cleanups.has(panel)) cleanups.set(panel, enhanceSheet(panel, config));
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
