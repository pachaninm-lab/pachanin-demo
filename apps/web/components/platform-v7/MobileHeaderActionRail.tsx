'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Calculator, CircleHelp, FileText, LogOut, Moon, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function clickNative(selector: string) {
  const button = document.querySelector<HTMLElement>(selector);
  button?.click();
}

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setMount(document.querySelector('.pc-v4-actions'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return mount;
}

export function MobileHeaderActionRail() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const mount = useHeaderActionsMount();
  const path = normalize(pathname);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    const next = stored === 'dark' ? 'dark' : 'light';
    setTheme(next);
  }, []);

  if (PUBLIC_PATHS.has(path) || !mount) return <style dangerouslySetInnerHTML={{ __html: css }} />;

  const toggleTheme = () => {
    setTheme((value) => {
      const next = value === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('pc-theme', next);
      window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {createPortal(
        <nav className='p7-mobile-action-rail' aria-label='Инструменты кабинета'>
          <button type='button' className='p7-mobile-action-btn' aria-label='Открыть поиск' onClick={() => clickNative('.pc-v4-search')}><Search size={16} /></button>
          <button type='button' className='p7-mobile-action-btn' aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button type='button' className='p7-mobile-action-btn' aria-label='Открыть блокнот' onClick={() => clickNative('.p7-note-widget > button[aria-label="Открыть блокнот"]')}><FileText size={16} /></button>
          <button type='button' className='p7-mobile-action-btn' aria-label='Открыть уведомления роли' onClick={() => clickNative('.pc-v7-notice-wrap > button[aria-label="Открыть уведомления роли"]')}><Bell size={16} /></button>
          <Link className='p7-mobile-action-btn' href={`/platform-v7/status?role=${role}`} aria-label='Статус и помощь'><CircleHelp size={16} /></Link>
          <button type='button' className='p7-mobile-action-btn' aria-label='Открыть калькулятор' onClick={() => clickNative('.p7-calc-widget > button[aria-label="Открыть калькулятор"]')}><Calculator size={16} /></button>
          <button type='button' className='p7-mobile-action-btn p7-mobile-action-logout' aria-label='Выйти из кабинета' onClick={() => clickNative('.pc-v7-logout-btn')}><LogOut size={16} /></button>
        </nav>,
        mount,
      )}
    </>
  );
}

const css = `
@media(max-width:767px){
  .pc-shell-root-v4 .pc-v4-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:0!important;min-width:0!important;overflow:visible!important}
  .pc-shell-root-v4 .pc-v4-actions>.pc-v4-search,
  .pc-shell-root-v4 .pc-v4-actions>.pc-v4-theme-toggle,
  .pc-shell-root-v4 .pc-v4-actions>.pc-v4-stage,
  .pc-shell-root-v4 .pc-v4-actions>.p7-role-support,
  .pc-shell-root-v4 .pc-v4-actions>.pc-v7-logout-btn,
  .pc-shell-root-v4 .pc-v4-actions>.pc-v7-notice-wrap>button,
  .pc-shell-root-v4 .pc-v4-actions>.p7-note-widget>button,
  .pc-shell-root-v4 .pc-v4-actions>.p7-calc-widget>button,
  .pc-shell-root-v4 .pc-v4-actions>div:not(.pc-v7-notice-wrap):has(>button[aria-label='Открыть уведомления']){position:absolute!important;inline-size:1px!important;block-size:1px!important;min-inline-size:1px!important;min-block-size:1px!important;max-inline-size:1px!important;max-block-size:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip-path:inset(50%)!important}
  .pc-shell-root-v4 .p7-mobile-action-rail{display:grid!important;grid-template-columns:repeat(7,30px)!important;gap:3px!important;align-items:center!important;justify-content:end!important;inline-size:max-content!important;max-inline-size:100%!important;position:relative!important;z-index:5!important}
  .pc-shell-root-v4 .p7-mobile-action-btn{inline-size:30px!important;block-size:30px!important;min-inline-size:30px!important;min-block-size:30px!important;max-inline-size:30px!important;max-block-size:30px!important;border-radius:11px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-card)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;text-decoration:none!important;box-shadow:var(--pc-shadow-sm)!important}
  .pc-shell-root-v4 .p7-mobile-action-btn svg{inline-size:16px!important;block-size:16px!important;max-inline-size:16px!important;max-block-size:16px!important}
  .pc-shell-root-v4 .p7-mobile-action-logout{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}
  .pc-shell-root-v4 .pc-v7-notice-panel,.pc-shell-root-v4 .p7-note-panel,.pc-shell-root-v4 .p7-calc-panel{position:fixed!important;left:10px!important;right:10px!important;top:64px!important;width:auto!important;max-width:none!important;z-index:900!important;opacity:1!important;clip-path:none!important;pointer-events:auto!important}
}
@media(max-width:374px){
  .pc-shell-root-v4 .p7-mobile-action-rail{grid-template-columns:repeat(7,28px)!important;gap:2px!important}
  .pc-shell-root-v4 .p7-mobile-action-btn{inline-size:28px!important;block-size:28px!important;min-inline-size:28px!important;min-block-size:28px!important;max-inline-size:28px!important;max-block-size:28px!important}
  .pc-shell-root-v4 .p7-mobile-action-btn svg{inline-size:15px!important;block-size:15px!important}
}
`;
