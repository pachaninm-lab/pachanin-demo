'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Calculator, CircleHelp, FileText, LogOut, Moon, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);
const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);

  useEffect(() => {
    const sync = () => setMount(document.querySelector('.pc-v4-header .pc-v4-actions'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return mount;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return mobile;
}

function clickNative(selector: string) {
  const button = document.querySelector<HTMLElement>(selector);
  if (!button) return false;
  button.click();
  return true;
}

function keepRailActive(actions: Element | null) {
  if (!(actions instanceof HTMLElement)) return;

  const rail = actions.querySelector<HTMLElement>('.p7-mobile-action-rail');
  if (rail) {
    rail.style.setProperty('display', 'grid', 'important');
    rail.style.setProperty('visibility', 'visible', 'important');
  }

  for (const selector of ['.p7-note-widget', '.p7-calc-widget', '.pc-v7-notice-wrap']) {
    const node = actions.querySelector<HTMLElement>(selector);
    if (node) node.style.setProperty('display', 'contents', 'important');
  }
}

function clearShellSession() {
  window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  window.localStorage.removeItem(STORE_KEY);
  document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
}

export function MobileHeaderActionRail() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const path = normalize(pathname);
  const mount = useHeaderActionsMount();
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    setTheme(stored === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const apply = () => keepRailActive(document.querySelector('.pc-v4-header .pc-v4-actions'));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [isMobile, path]);

  if (PUBLIC_PATHS.has(path) || !mount || !isMobile) return null;

  const toggleTheme = () => {
    setTheme((value) => {
      const next = value === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('pc-theme', next);
      window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  };

  const logout = () => {
    if (clickNative('.pc-v7-logout-btn')) return;
    clearRoleSelection();
    clearShellSession();
    window.location.assign('/platform-v7');
  };

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className='p7-mobile-action-rail' aria-label='Инструменты кабинета'>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть поиск' onClick={() => clickNative('.pc-v4-search')}><Search size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть блокнот' onClick={() => clickNative('.p7-note-widget button[aria-label="Открыть блокнот"]')}><FileText size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть уведомления роли' onClick={() => clickNative('.pc-v7-notice-wrap button[aria-label="Открыть уведомления роли"], .pc-v4-actions button[aria-label="Открыть уведомления"]')}><Bell size={16} /></button>
        <Link className='p7-mobile-action-btn' href={`/platform-v7/status?role=${role}`} aria-label='Статус и помощь'><CircleHelp size={16} /></Link>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть калькулятор' onClick={() => clickNative('.p7-calc-widget button[aria-label="Открыть калькулятор"]')}><Calculator size={16} /></button>
        <button type='button' className='p7-mobile-action-btn p7-mobile-action-logout' aria-label='Выйти из кабинета' onClick={logout}><LogOut size={16} /></button>
      </nav>
    </>,
    mount,
  );
}

const css = `
@media(max-width:767px){
  html body .pc-shell-root-v4 .pc-v4-actions > .p7-mobile-action-rail{display:grid!important;grid-template-columns:repeat(7,30px)!important;gap:3px!important;align-items:center!important;justify-content:end!important;inline-size:max-content!important;max-inline-size:100%!important;z-index:4!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;flex:0 0 auto!important;position:relative!important}
  html body .p7-mobile-action-btn{inline-size:30px!important;block-size:30px!important;min-inline-size:30px!important;min-block-size:30px!important;max-inline-size:30px!important;max-block-size:30px!important;border-radius:11px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-card)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;text-decoration:none!important;box-shadow:var(--pc-shadow-sm)!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
  html body .p7-mobile-action-btn svg{inline-size:16px!important;block-size:16px!important;max-inline-size:16px!important;max-block-size:16px!important}
  html body .p7-mobile-action-logout{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}
}
@media(max-width:374px){
  html body .pc-shell-root-v4 .pc-v4-actions > .p7-mobile-action-rail{grid-template-columns:repeat(7,28px)!important;gap:2px!important}
  html body .p7-mobile-action-btn{inline-size:28px!important;block-size:28px!important;min-inline-size:28px!important;min-block-size:28px!important;max-inline-size:28px!important;max-block-size:28px!important}
  html body .p7-mobile-action-btn svg{inline-size:15px!important;block-size:15px!important}
}
`;
