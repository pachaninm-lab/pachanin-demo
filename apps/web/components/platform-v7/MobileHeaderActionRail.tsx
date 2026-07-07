'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CircleHelp, FileText, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs', '/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/deal-flow']);
const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const NOTE_STORAGE_KEY = 'platform-v7-header-notepad';
const LOGOUT_TARGET = '/platform-v7/login?logout=1';

type MobilePanel = 'menu' | 'notepad' | 'notices' | null;

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'оператора',
  buyer: 'покупателя',
  seller: 'продавца',
  logistics: 'логистики',
  driver: 'водителя',
  surveyor: 'сюрвейера',
  elevator: 'приёмки',
  lab: 'лаборатории',
  bank: 'банка',
  arbitrator: 'арбитража',
  compliance: 'комплаенса',
  executive: 'руководителя',
};

const ROLE_NOTICE: Record<PlatformRole, { title: string; text: string; href: string }> = {
  operator: { title: 'Блокеры исполнения', text: 'Проверь центр управления и очередь сделок.', href: '/platform-v7/control-tower' },
  buyer: { title: 'Закупка', text: 'Есть шаги по заявке покупателя.', href: '/platform-v7/procurement' },
  seller: { title: 'Документы продавца', text: 'СДИЗ и ЭТрН должны закрыть основание для проверки.', href: '/platform-v7/seller#documents' },
  logistics: { title: 'Рейсы', text: 'Есть маршрут или отклонение по логистике.', href: '/platform-v7/logistics' },
  driver: { title: 'Маршрут', text: 'Зафиксируй ближайшее событие рейса.', href: '/platform-v7/driver/field' },
  surveyor: { title: 'Осмотр', text: 'Есть назначение на фиксацию фактов.', href: '/platform-v7/surveyor' },
  elevator: { title: 'Приёмка', text: 'Есть действие по весу или акту.', href: '/platform-v7/elevator' },
  lab: { title: 'Протокол', text: 'Есть действие по пробе или качеству.', href: '/platform-v7/lab' },
  bank: { title: 'Основание', text: 'Есть банковский шаг по проверке.', href: '/platform-v7/bank/payment-basis' },
  arbitrator: { title: 'Разбор', text: 'Есть действие по доказательствам.', href: '/platform-v7/arbitrator' },
  compliance: { title: 'Допуск', text: 'Есть стоп-фактор или документ.', href: '/platform-v7/compliance' },
  executive: { title: 'Сводка', text: 'Есть управленческий риск или блокер.', href: '/platform-v7/executive' },
};

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
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
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const path = normalize(pathname);
  const headerMount = useHeaderActionsMount();
  const bodyMount = useBodyMount();
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

  if (PUBLIC_PATHS.has(path) || !headerMount || !bodyMount || !isMobile) return null;

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
    setPanel(null);
    clearRoleSelection();
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
    clearCookie('pc-role');
    clearCookie('pc-session');
    router.replace(LOGOUT_TARGET, { scroll: true });
    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (!window.location.pathname.startsWith('/platform-v7/login')) window.location.assign(LOGOUT_TARGET);
    });
  };

  const openPanel = (next: MobilePanel) => setPanel((value) => value === next ? null : next);
  const notice = ROLE_NOTICE[role];

  const button = (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <button type='button' className='p7-mobile-tools-trigger pc-v4-iconbtn' aria-label='Открыть инструменты страницы' title='Инструменты' onClick={() => openPanel('menu')}>
        <Menu size={17} strokeWidth={2.35} />
      </button>
    </>
  );

  const panelNode = panel ? (
    <ToolPanel
      panel={panel}
      note={note}
      setNote={setNote}
      close={() => setPanel(null)}
      role={role}
      notice={notice}
      theme={theme}
      toggleTheme={toggleTheme}
      openSearch={() => {
        setPanel(null);
        openSearchPalette();
      }}
      logout={logout}
      openPanel={openPanel}
    />
  ) : null;

  return (
    <>
      {createPortal(button, headerMount)}
      {createPortal(panelNode, bodyMount)}
    </>
  );
}

function ToolPanel({
  panel,
  note,
  setNote,
  close,
  role,
  notice,
  theme,
  toggleTheme,
  openSearch,
  logout,
  openPanel,
}: {
  panel: Exclude<MobilePanel, null>;
  note: string;
  setNote: (value: string) => void;
  close: () => void;
  role: PlatformRole;
  notice: { title: string; text: string; href: string };
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  openSearch: () => void;
  logout: () => void;
  openPanel: (next: MobilePanel) => void;
}) {
  const title = panel === 'notepad' ? 'Блокнот' : panel === 'notices' ? 'Уведомления' : `Инструменты ${ROLE_LABELS[role]}`;

  return (
    <section className='p7-mobile-tool-panel' role='dialog' aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type='button' onClick={close} aria-label='Закрыть'><X size={15} /></button>
      </header>

      {panel === 'menu' ? (
        <div className='p7-mobile-tool-grid'>
          <button type='button' onClick={openSearch}><Search size={16} /><span>Поиск</span></button>
          <button type='button' onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>Тема</span></button>
          <button type='button' onClick={() => openPanel('notepad')}><FileText size={16} /><span>Блокнот</span></button>
          <button type='button' onClick={() => openPanel('notices')}><Bell size={16} /><span>Уведомления</span></button>
          <Link href={`/platform-v7/status?role=${role}`} onClick={close}><CircleHelp size={16} /><span>Помощь</span></Link>
          <button type='button' className='p7-mobile-danger' onClick={logout}><LogOut size={16} /><span>Выход</span></button>
        </div>
      ) : null}

      {panel === 'notepad' ? (
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder='Заметка по сделке, рейсу, весу, телефону или сумме.' spellCheck={false} />
      ) : null}

      {panel === 'notices' ? (
        <Link href={notice.href} className='p7-mobile-notice-link' onClick={close}>
          <strong>{notice.title}</strong>
          <span>{notice.text}</span>
        </Link>
      ) : null}
    </section>
  );
}

const css = `
@media(max-width:767px){
  html body .pc-shell-root-v4 .pc-v4-actions{gap:4px!important;overflow:hidden!important;max-inline-size:100%!important;min-inline-size:0!important}
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-stage,
  html body .pc-shell-root-v4 .pc-v4-actions button[aria-label='Открыть уведомления'],
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-notice-wrap,
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-logout-btn,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-note-widget,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-role-support{display:none!important}
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-calc-widget .pc-v4-iconbtn,
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-theme-toggle,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-mobile-tools-trigger{inline-size:38px!important;min-inline-size:38px!important;max-inline-size:38px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important;border-radius:13px!important;padding:0!important;flex:0 0 38px!important}
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search strong,
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search span{display:none!important}
  html body .pc-shell-root-v4 .pc-v4-actions .p7-mobile-tools-trigger{display:inline-flex!important;align-items:center!important;justify-content:center!important}
  html body .p7-mobile-tool-panel{position:fixed!important;left:10px!important;right:10px!important;top:calc(env(safe-area-inset-top) + 60px)!important;z-index:5010!important;display:grid!important;gap:10px!important;padding:12px!important;border:1px solid var(--pc-border)!important;border-radius:20px!important;background:var(--pc-bg-card)!important;color:var(--pc-text-primary)!important;box-shadow:var(--pc-shadow-lg)!important}
  html body .p7-mobile-tool-panel header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
  html body .p7-mobile-tool-panel header strong{font-size:14px!important;font-weight:950!important;line-height:1.2!important}
  html body .p7-mobile-tool-panel header button{inline-size:32px!important;block-size:32px!important;border-radius:12px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
  html body .p7-mobile-tool-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  html body .p7-mobile-tool-grid button,
  html body .p7-mobile-tool-grid a{min-height:46px!important;border-radius:15px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-primary)!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;padding:0 12px!important;text-decoration:none!important;font-size:12px!important;font-weight:900!important}
  html body .p7-mobile-tool-grid .p7-mobile-danger{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}
  html body .p7-mobile-tool-panel textarea{inline-size:100%!important;min-height:240px!important;border:1px solid var(--pc-border)!important;border-radius:17px!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-primary)!important;padding:12px!important;font-size:14px!important;line-height:1.45!important;font-weight:650!important;outline:none!important;resize:vertical!important}
  html body .p7-mobile-tool-panel textarea::placeholder{color:var(--pc-text-muted)!important;font-weight:700!important}
  html body .p7-mobile-notice-link{display:grid!important;gap:5px!important;padding:12px!important;border-radius:16px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;text-decoration:none!important;color:var(--pc-text-primary)!important}
  html body .p7-mobile-notice-link strong{font-size:13px!important;font-weight:950!important}
  html body .p7-mobile-notice-link span{font-size:12px!important;line-height:1.4!important;color:var(--pc-text-muted)!important;font-weight:800!important}
}
@media(max-width:374px){
  html body .pc-shell-root-v4 .pc-v4-actions{gap:3px!important}
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-calc-widget .pc-v4-iconbtn,
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-theme-toggle,
  html body .pc-shell-root-v4 .pc-v4-actions .p7-mobile-tools-trigger{inline-size:34px!important;min-inline-size:34px!important;max-inline-size:34px!important;block-size:34px!important;min-block-size:34px!important;max-block-size:34px!important;flex-basis:34px!important}
}
@media(min-width:768px){
  html body .p7-mobile-tools-trigger{display:none!important}
}
`;
