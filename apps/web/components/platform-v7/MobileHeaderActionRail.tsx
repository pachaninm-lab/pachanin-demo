'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Calculator, CircleHelp, FileText, LogOut, Moon, Search, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs', '/platform-v7/demo', '/platform-v7/contact']);
const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const NOTE_STORAGE_KEY = 'platform-v7-header-notepad';

type MobilePanel = 'notepad' | 'notices' | 'calculator' | null;

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function useBodyMount() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useEffect(() => setMount(document.body), []);
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

function openSearchPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true, cancelable: true }));
}

export function MobileHeaderActionRail() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const path = normalize(pathname);
  const mount = useBodyMount();
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [panel, setPanel] = useState<MobilePanel>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    setTheme(window.localStorage.getItem('pc-theme') === 'dark' ? 'dark' : 'light');
    setNote(window.localStorage.getItem(NOTE_STORAGE_KEY) ?? '');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(NOTE_STORAGE_KEY, note);
  }, [note]);

  useEffect(() => setPanel(null), [path]);

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
    clearRoleSelection();
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
    window.location.assign('/platform-v7');
  };

  const openPanel = (next: MobilePanel) => setPanel((value) => value === next ? null : next);

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className='p7-mobile-action-rail' aria-label='Инструменты кабинета'>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть поиск' onClick={openSearchPalette}><Search size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Сменить тему' onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть блокнот' onClick={() => openPanel('notepad')}><FileText size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть уведомления' onClick={() => openPanel('notices')}><Bell size={16} /></button>
        <Link className='p7-mobile-action-btn' href={`/platform-v7/status?role=${role}`} aria-label='Статус и помощь'><CircleHelp size={16} /></Link>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть калькулятор' onClick={() => openPanel('calculator')}><Calculator size={16} /></button>
        <button type='button' className='p7-mobile-action-btn p7-mobile-action-logout' aria-label='Выйти из кабинета' onClick={logout}><LogOut size={16} /></button>
      </nav>
      {panel ? <ToolPanel panel={panel} note={note} setNote={setNote} close={() => setPanel(null)} /> : null}
    </>,
    mount,
  );
}

function ToolPanel({ panel, note, setNote, close }: { panel: MobilePanel; note: string; setNote: (value: string) => void; close: () => void }) {
  const title = panel === 'notepad' ? 'Блокнот' : panel === 'calculator' ? 'Калькулятор' : 'Уведомления';
  return <section className='p7-mobile-tool-panel' role='dialog' aria-label={title}><header><strong>{title}</strong><button type='button' onClick={close} aria-label='Закрыть'><X size={15} /></button></header>{panel === 'notepad' ? <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder='Заметка по сделке.' /> : panel === 'calculator' ? <div className='p7-mobile-simple-panel'>Используйте штатный калькулятор в кабинете.</div> : <div className='p7-mobile-simple-panel'>Уведомления роли отображаются в рабочем кабинете.</div>}</section>;
}

const css = `@media(max-width:767px){html body .p7-mobile-action-rail{position:fixed!important;top:8px!important;right:8px!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(7,30px)!important;gap:3px!important}.p7-mobile-action-btn{inline-size:30px!important;block-size:30px!important;border-radius:11px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-card)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;text-decoration:none!important;box-shadow:var(--pc-shadow-sm)!important}.p7-mobile-action-logout{color:#9f1d1d!important}.p7-mobile-tool-panel{position:fixed!important;left:10px!important;right:10px!important;top:64px!important;z-index:5010!important;display:grid!important;gap:10px!important;padding:12px!important;border:1px solid var(--pc-border)!important;border-radius:20px!important;background:var(--pc-bg-card)!important;box-shadow:var(--pc-shadow-lg)!important}.p7-mobile-tool-panel header{display:flex!important;align-items:center!important;justify-content:space-between!important}.p7-mobile-tool-panel header button{inline-size:32px!important;block-size:32px!important;border-radius:12px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important}.p7-mobile-tool-panel textarea{inline-size:100%!important;min-height:220px!important;border:1px solid var(--pc-border)!important;border-radius:17px!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-primary)!important;padding:12px!important}.p7-mobile-simple-panel{padding:14px;border-radius:16px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);font-size:13px;font-weight:800}}`;
