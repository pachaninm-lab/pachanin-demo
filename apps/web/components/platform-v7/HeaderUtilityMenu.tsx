'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Calculator,
  CircleHelp,
  FileSearch2,
  FileText,
  LogOut,
  Moon,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { SESSION_COOKIE } from '@/lib/auth-cookies';
import styles from './HeaderUtilityMenu.module.css';

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/docs',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/deal-flow',
]);
const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const NOTE_STORAGE_KEY = 'platform-v7-header-notepad';
const LOGOUT_TARGET = '/platform-v7/login?logout=1';
const NOTIFICATIONS_ROUTE = '/platform-v7/notifications';

type Panel = 'menu' | 'notepad' | null;

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

function normalize(pathname: string | null): string {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function useMount(selector: string): Element | null {
  const [mount, setMount] = React.useState<Element | null>(null);

  React.useEffect(() => {
    const sync = () => setMount(document.querySelector(selector));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selector]);

  return mount;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function activateNativeAction(selector: string): boolean {
  const control = document.querySelector<HTMLElement>(selector);
  if (!control) return false;
  control.click();
  return true;
}

function ActionCard({ icon, title, description, onClick }: ActionCardProps) {
  return (
    <button className={styles.action} type='button' onClick={onClick}>
      <span className={styles.actionIcon}>{icon}</span>
      <span className={styles.actionCopy}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}

export function HeaderUtilityMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const path = normalize(pathname);
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const headerMount = useMount('.pc-v4-actions');
  const bodyMount = useMount('body');
  const [panel, setPanel] = React.useState<Panel>(null);
  const [note, setNote] = React.useState('');
  const [noteReady, setNoteReady] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState('');
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const shell = headerMount?.closest('.pc-shell-root-v4');
    if (!shell) return;
    shell.classList.add(styles.simplifiedShell);
    return () => shell.classList.remove(styles.simplifiedShell);
  }, [headerMount]);

  React.useEffect(() => {
    try {
      setNote(window.localStorage.getItem(NOTE_STORAGE_KEY) || '');
    } catch {
      setNote('');
    } finally {
      setNoteReady(true);
    }
  }, []);

  React.useEffect(() => {
    if (panel) closeButtonRef.current?.focus();
  }, [panel]);

  React.useEffect(() => {
    if (!panel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [panel]);

  React.useEffect(() => setPanel(null), [path]);

  React.useEffect(() => {
    if (!noteReady) return;
    try {
      window.localStorage.setItem(NOTE_STORAGE_KEY, note);
      setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setSavedAt('локальное сохранение недоступно');
    }
  }, [note, noteReady]);

  if (PUBLIC_PATHS.has(path) || !headerMount || !bodyMount) return null;

  const runNativeAction = (selector: string) => {
    setPanel(null);
    window.requestAnimationFrame(() => activateNativeAction(selector));
  };

  const logout = () => {
    setPanel(null);
    clearRoleSelection();
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
    clearCookie('pc-role');
    clearCookie(SESSION_COOKIE);
    router.replace(LOGOUT_TARGET, { scroll: true });
    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (!window.location.pathname.startsWith('/platform-v7/login')) window.location.assign(LOGOUT_TARGET);
    });
  };

  const trigger = (
    <div className={styles.root}>
      <button
        className={styles.trigger}
        type='button'
        aria-label='Открыть помощь и инструменты'
        aria-expanded={panel !== null}
        aria-haspopup='dialog'
        data-open={panel ? 'true' : 'false'}
        onClick={() => setPanel((current) => current ? null : 'menu')}
      >
        <CircleHelp size={18} aria-hidden='true' />
        <span className={styles.triggerText}>Помощь</span>
      </button>
    </div>
  );

  const panelNode = panel ? (
    <>
      <button className={styles.backdrop} type='button' aria-label='Закрыть помощь и инструменты' onClick={() => setPanel(null)} />
      <section className={styles.panel} role='dialog' aria-modal='true' aria-label={panel === 'notepad' ? 'Блокнот' : 'Помощь и инструменты'}>
        <header className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <strong>{panel === 'notepad' ? 'Блокнот' : 'Помощь и инструменты'}</strong>
            <span>{panel === 'notepad' ? 'Личная заметка сохраняется только на этом устройстве.' : 'Все дополнительные функции собраны в одном месте.'}</span>
          </div>
          <button ref={closeButtonRef} className={styles.closeButton} type='button' aria-label='Закрыть' onClick={() => setPanel(null)}>
            <X size={18} aria-hidden='true' />
          </button>
        </header>

        {panel === 'menu' ? (
          <>
            <section className={styles.section} aria-labelledby='utility-work-title'>
              <h2 className={styles.sectionTitle} id='utility-work-title'>Работа</h2>
              <div className={styles.actionGrid}>
                <ActionCard icon={<Search size={18} aria-hidden='true' />} title='Найти' description='Открыть поиск по платформе' onClick={() => runNativeAction('.pc-v4-search')} />
                <Link className={styles.linkAction} href={NOTIFICATIONS_ROUTE} onClick={() => setPanel(null)}>
                  <span className={styles.actionIcon}><Bell size={18} aria-hidden='true' /></span>
                  <span className={styles.actionCopy}><strong>Уведомления</strong><span>Открыть фактические события аккаунта</span></span>
                </Link>
              </div>
            </section>

            <section className={styles.section} aria-labelledby='utility-help-title'>
              <h2 className={styles.sectionTitle} id='utility-help-title'>Нужна помощь</h2>
              <div className={styles.actionGrid}>
                <Link className={styles.linkAction} href={PLATFORM_V7_AI_ROUTE} onClick={() => setPanel(null)}>
                  <span className={styles.actionIcon}><FileSearch2 size={18} aria-hidden='true' /></span>
                  <span className={styles.actionCopy}><strong>Разобрать шаг</strong><span>Объяснить текущую задачу</span></span>
                </Link>
                <Link className={styles.linkAction} href='/platform-v7/status' onClick={() => setPanel(null)}>
                  <span className={styles.actionIcon}><CircleHelp size={18} aria-hidden='true' /></span>
                  <span className={styles.actionCopy}><strong>Помощь по работе</strong><span>Статус, инструкция и поддержка</span></span>
                </Link>
              </div>
            </section>

            <section className={styles.section} aria-labelledby='utility-tools-title'>
              <h2 className={styles.sectionTitle} id='utility-tools-title'>Дополнительно</h2>
              <div className={styles.actionGrid}>
                <ActionCard icon={<Calculator size={18} aria-hidden='true' />} title='Калькулятор' description='Обычный и ролевой расчёт' onClick={() => runNativeAction("button[aria-label='Открыть калькулятор']")} />
                <ActionCard icon={<FileText size={18} aria-hidden='true' />} title='Блокнот' description='Записать вес, сумму или задачу' onClick={() => setPanel('notepad')} />
                <ActionCard icon={<Moon size={18} aria-hidden='true' />} title='Сменить тему' description='Светлый или тёмный экран' onClick={() => runNativeAction('.pc-v4-theme-toggle')} />
              </div>
            </section>

            <button className={styles.logout} type='button' onClick={logout}>
              <LogOut size={18} aria-hidden='true' />Выйти из платформы
            </button>
          </>
        ) : (
          <section className={styles.notePanel}>
            <button className={styles.backButton} type='button' onClick={() => setPanel('menu')}>
              Вернуться к инструментам
            </button>
            <textarea
              aria-label='Текст блокнота'
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder='Запиши вес, сумму, телефон или следующую задачу.'
              spellCheck={false}
            />
            <div className={styles.noteFooter}>
              <span>{note.length} знаков{savedAt ? ` · сохранено ${savedAt}` : ''}</span>
              <button className={styles.clearNote} type='button' disabled={!note.trim()} onClick={() => setNote('')}>
                <Trash2 size={16} aria-hidden='true' />Очистить
              </button>
            </div>
          </section>
        )}
      </section>
    </>
  ) : null;

  return (
    <>
      {createPortal(trigger, headerMount)}
      {createPortal(panelNode, bodyMount)}
    </>
  );
}
