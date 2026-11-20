'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import styles from './GektaWorkspace.module.css';

type InstallPrompt = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type InstallPlatform = 'ios' | 'android' | 'macSafari' | 'desktop';
type InstallGuide = { platform: InstallPlatform; returnFocus: HTMLElement | null };

const COPY = {
  ru: {
    title: 'Установить Гекту',
    short: 'Установить',
    close: 'Закрыть',
    ios: ['Открой эту страницу в Safari.', 'Нажми «Поделиться» → «На экран „Домой“».', 'Включи «Открыть как веб-приложение», если есть этот переключатель, и нажми «Добавить».'],
    android: ['Открой меню ⋮ в Chrome.', 'Выбери «Добавить на главный экран» или «Установить приложение».', 'Подтверди установку.'],
    macSafari: ['В Safari открой меню «Файл» → «Добавить в Dock».', 'Нажми «Добавить».'],
    desktop: ['В Chrome или Edge нажми значок установки в адресной строке.', 'Если значка нет, открой меню браузера и выбери установку страницы как приложения.'],
  },
  en: {
    title: 'Install Gekta',
    short: 'Install',
    close: 'Close',
    ios: ['Open this page in Safari.', 'Tap Share → Add to Home Screen.', 'Turn on Open as Web App if offered, then tap Add.'],
    android: ['Open the ⋮ menu in Chrome.', 'Choose Add to Home screen or Install app.', 'Confirm installation.'],
    macSafari: ['In Safari choose File → Add to Dock.', 'Click Add.'],
    desktop: ['In Chrome or Edge, select the install icon in the address bar.', 'If there’s no icon, look for the option to install this page as an app in the browser menu.'],
  },
  zh: {
    title: '安装 Gekta',
    short: '安装',
    close: '关闭',
    ios: ['在 Safari 中打开此页面。', '轻点“共享”→“添加到主屏幕”。', '如有“作为网页 App 打开”选项，请开启后轻点“添加”。'],
    android: ['在 Chrome 中打开 ⋮ 菜单。', '选择“添加到主屏幕”或“安装应用”。', '确认安装。'],
    macSafari: ['在 Safari 中选择“文件”→“添加到程序坞”。', '点按“添加”。'],
    desktop: ['在 Chrome 或 Edge 中点击地址栏的安装图标。', '如果没有图标，请在浏览器菜单中查找将此页面安装为应用的选项。'],
  },
} satisfies Record<GektaLocale, { title: string; short: string; close: string } & Record<InstallPlatform, string[]>>;

function installPlatform(): InstallPlatform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/u.test(agent) || (/Macintosh/u.test(agent) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/u.test(agent)) return 'android';
  if (/Macintosh/u.test(agent) && /Safari/u.test(agent) && !/Chrome|Chromium|Edg/u.test(agent)) return 'macSafari';
  return 'desktop';
}

export function useGektaInstall() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [guide, setGuide] = useState<InstallGuide | null>(null);

  useEffect(() => {
    const display = window.matchMedia?.('(display-mode: standalone)');
    const syncDisplay = () => setStandalone(display?.matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    const onInstalled = () => setStandalone(true);

    syncDisplay();
    display?.addEventListener('change', syncDisplay);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      display?.removeEventListener('change', syncDisplay);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function requestInstall(returnFocus: HTMLElement | null) {
    const nativePrompt = prompt.current;
    if (nativePrompt) {
      prompt.current = null;
      try {
        await nativePrompt.prompt();
        await nativePrompt.userChoice;
        return;
      } catch {
        // The browser menu is still available if the native prompt expires.
      }
    }
    setGuide({ platform: installPlatform(), returnFocus });
  }

  return { canInstall: !standalone, guide, requestInstall, dismissGuide: () => setGuide(null) };
}

export function GektaInstallButton({ locale, onInstall, menuClassName }: {
  locale: GektaLocale;
  onInstall: (button: HTMLButtonElement) => void;
  menuClassName?: string;
}) {
  const copy = COPY[locale];
  return (
    <button type='button' className={menuClassName ?? styles.installButton}
      onClick={(event) => onInstall(event.currentTarget)} aria-label={copy.title} title={copy.title}>
      <Download size={17} aria-hidden='true' /><span>{menuClassName ? copy.title : copy.short}</span>
    </button>
  );
}

export function GektaInstallGuide({ locale, guide, onDismiss }: {
  locale: GektaLocale;
  guide: InstallGuide;
  onDismiss: () => void;
}) {
  const copy = COPY[locale];
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog ref={dialog} className={styles.installDialog} aria-labelledby='gekta-install-title'
      onClose={() => { onDismiss(); guide.returnFocus?.focus({ preventScroll: true }); }}>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h2 id='gekta-install-title' className='text-lg font-semibold'>{copy.title}</h2>
        <button type='button' className={styles.iconButton} onClick={() => dialog.current?.close()} aria-label={copy.close}><X size={18} aria-hidden='true' /></button>
      </div>
      <ol>{copy[guide.platform].map((step) => <li key={step}>{step}</li>)}</ol>
    </dialog>
  );
}
