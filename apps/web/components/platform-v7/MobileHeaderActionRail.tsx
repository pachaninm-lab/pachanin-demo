'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Calculator, CircleHelp, Delete, FileText, LogOut, Moon, Search, Sun, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);
const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const NOTE_STORAGE_KEY = 'platform-v7-header-notepad';

type MobilePanel = 'notepad' | 'notices' | 'calculator' | null;

const ROLE_LABELS: Record<string, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

const MOBILE_NOTICES: Record<string, { title: string; note: string; href: string }[]> = {
  operator: [
    { title: 'Есть блокеры исполнения', note: 'Проверь центр управления и очередь сделок.', href: '/platform-v7/control-tower' },
    { title: 'Нужна проверка документов', note: 'Есть сделки с незакрытым пакетом.', href: '/platform-v7/deals' },
  ],
  buyer: [{ title: 'Проверь закупки', note: 'Есть шаги по заявке покупателя.', href: '/platform-v7/procurement' }],
  seller: [{ title: 'Проверь документы', note: 'СДИЗ и ЭТрН должны закрыть основание для банка.', href: '/platform-v7/seller#documents' }],
  logistics: [{ title: 'Проверь рейсы', note: 'Есть маршрут или отклонение по логистике.', href: '/platform-v7/logistics' }],
  driver: [{ title: 'Проверь маршрут', note: 'Зафиксируй ближайшее событие рейса.', href: '/platform-v7/driver/field' }],
  surveyor: [{ title: 'Проверь осмотр', note: 'Есть назначение на фиксацию фактов.', href: '/platform-v7/surveyor' }],
  elevator: [{ title: 'Проверь приёмку', note: 'Есть действие по весу или акту.', href: '/platform-v7/elevator' }],
  lab: [{ title: 'Проверь протокол', note: 'Есть действие по пробе или качеству.', href: '/platform-v7/lab' }],
  bank: [{ title: 'Проверь основание', note: 'Есть банковский шаг по проверке.', href: '/platform-v7/bank' }],
  arbitrator: [{ title: 'Проверь разбор', note: 'Есть действие по доказательствам.', href: '/platform-v7/arbitrator' }],
  compliance: [{ title: 'Проверь допуск', note: 'Есть стоп-фактор или документ.', href: '/platform-v7/compliance' }],
  executive: [{ title: 'Проверь сводку', note: 'Есть управленческий риск или блокер.', href: '/platform-v7/executive' }],
};

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

function parkActionHost(node: HTMLElement | null) {
  if (!node) return;
  node.style.setProperty('display', 'inline-flex', 'important');
  node.style.setProperty('position', 'relative', 'important');
  node.style.setProperty('width', '0', 'important');
  node.style.setProperty('min-width', '0', 'important');
  node.style.setProperty('max-width', '0', 'important');
  node.style.setProperty('height', '0', 'important');
  node.style.setProperty('min-height', '0', 'important');
  node.style.setProperty('max-height', '0', 'important');
  node.style.setProperty('overflow', 'visible', 'important');
  node.style.setProperty('visibility', 'visible', 'important');
  node.style.setProperty('opacity', '1', 'important');
}

function hideSourceAction(node: HTMLElement | null) {
  if (!node) return;
  node.style.setProperty('position', 'absolute', 'important');
  node.style.setProperty('width', '1px', 'important');
  node.style.setProperty('min-width', '1px', 'important');
  node.style.setProperty('max-width', '1px', 'important');
  node.style.setProperty('height', '1px', 'important');
  node.style.setProperty('min-height', '1px', 'important');
  node.style.setProperty('max-height', '1px', 'important');
  node.style.setProperty('padding', '0', 'important');
  node.style.setProperty('margin', '0', 'important');
  node.style.setProperty('opacity', '0', 'important');
  node.style.setProperty('pointer-events', 'none', 'important');
  node.style.setProperty('overflow', 'hidden', 'important');
}

function keepRailActive(actions: Element | null) {
  if (!(actions instanceof HTMLElement)) return;

  const rail = actions.querySelector<HTMLElement>('.p7-mobile-action-rail');
  if (rail) {
    rail.style.setProperty('display', 'grid', 'important');
    rail.style.setProperty('visibility', 'visible', 'important');
    rail.style.setProperty('opacity', '1', 'important');
    rail.style.setProperty('pointer-events', 'auto', 'important');
  }

  for (const selector of ['.p7-note-widget', '.p7-calc-widget', '.pc-v7-notice-wrap']) {
    parkActionHost(actions.querySelector<HTMLElement>(selector));
  }

  for (const selector of [
    '.pc-v4-search',
    '.pc-v4-theme-toggle',
    '.p7-role-support',
    '.pc-v7-logout-btn',
    '.p7-note-widget > button',
    '.p7-calc-widget > button',
    '.pc-v7-notice-wrap > button',
    'button[aria-label="Открыть уведомления"]',
  ]) {
    hideSourceAction(actions.querySelector<HTMLElement>(selector));
  }
}

function clearShellSession() {
  window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  window.localStorage.removeItem(STORE_KEY);
  document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
  document.cookie = 'pc_v7_entry_seen=; Max-Age=0; Path=/; SameSite=Lax';
}

function openSearchPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true, cancelable: true }));
}

function applyOperation(left: number, right: number, operator: string | null) {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '×') return left * right;
  if (operator === '÷') return right === 0 ? Number.NaN : left / right;
  return right;
}

function formatCalc(value: number) {
  if (!Number.isFinite(value)) return 'Ошибка';
  return String(Math.round(value * 100000000) / 100000000).replace('.', ',');
}

export function MobileHeaderActionRail() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const path = normalize(pathname);
  const mount = useHeaderActionsMount();
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [panel, setPanel] = useState<MobilePanel>(null);
  const [note, setNote] = useState('');
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcStored, setCalcStored] = useState<number | null>(null);
  const [calcOperator, setCalcOperator] = useState<string | null>(null);
  const [calcFresh, setCalcFresh] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    setTheme(stored === 'dark' ? 'dark' : 'light');
    setNote(window.localStorage.getItem(NOTE_STORAGE_KEY) ?? '');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(NOTE_STORAGE_KEY, note);
  }, [note]);

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

  useEffect(() => {
    setPanel(null);
  }, [path]);

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
    clearShellSession();
    window.location.assign('/platform-v7');
  };

  const openPanel = (next: MobilePanel) => setPanel((value) => value === next ? null : next);

  const calcNumber = () => Number(calcDisplay.replace(',', '.'));
  const chooseCalcOperator = (operator: string) => {
    const current = calcNumber();
    if (calcStored === null || calcOperator === null) {
      setCalcStored(current);
    } else if (!calcFresh) {
      const result = applyOperation(calcStored, current, calcOperator);
      setCalcStored(result);
      setCalcDisplay(formatCalc(result));
    }
    setCalcOperator(operator);
    setCalcFresh(true);
  };
  const inputCalc = (digit: string) => {
    setCalcDisplay((value) => calcFresh || value === '0' || value === 'Ошибка' ? digit : value.length >= 14 ? value : value + digit);
    setCalcFresh(false);
  };
  const inputDecimal = () => {
    setCalcDisplay((value) => calcFresh || value === 'Ошибка' ? '0,' : value.includes(',') ? value : value + ',');
    setCalcFresh(false);
  };
  const calculate = () => {
    if (calcStored === null || calcOperator === null) return;
    setCalcDisplay(formatCalc(applyOperation(calcStored, calcNumber(), calcOperator)));
    setCalcStored(null);
    setCalcOperator(null);
    setCalcFresh(true);
  };
  const clearCalc = () => {
    setCalcDisplay('0');
    setCalcStored(null);
    setCalcOperator(null);
    setCalcFresh(true);
  };

  const notices = MOBILE_NOTICES[role] ?? MOBILE_NOTICES.operator;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className='p7-mobile-action-rail' aria-label='Инструменты кабинета'>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть поиск' onClick={openSearchPalette}><Search size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть блокнот' onClick={() => openPanel('notepad')}><FileText size={16} /></button>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть уведомления роли' onClick={() => openPanel('notices')}><Bell size={16} /></button>
        <Link className='p7-mobile-action-btn' href={`/platform-v7/status?role=${role}`} aria-label='Статус и помощь'><CircleHelp size={16} /></Link>
        <button type='button' className='p7-mobile-action-btn' aria-label='Открыть калькулятор' onClick={() => openPanel('calculator')}><Calculator size={16} /></button>
        <button type='button' className='p7-mobile-action-btn p7-mobile-action-logout' aria-label='Выйти из кабинета' onClick={logout}><LogOut size={16} /></button>
      </nav>

      {panel === 'notepad' ? (
        <section className='p7-mobile-tool-panel' role='dialog' aria-label='Блокнот'>
          <header><strong>Блокнот</strong><button type='button' onClick={() => setPanel(null)} aria-label='Закрыть блокнот'><X size={15} /></button></header>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder='Запиши телефон, вес, сумму, задачу или важную мысль по сделке.' spellCheck={false} />
          <footer><span>{note.length} знаков · локально</span><button type='button' onClick={() => setNote('')} disabled={!note.trim()}><Trash2 size={14} />Очистить</button></footer>
        </section>
      ) : null}

      {panel === 'notices' ? (
        <section className='p7-mobile-tool-panel' role='dialog' aria-label='Уведомления роли'>
          <header><strong>Уведомления · {ROLE_LABELS[role] ?? 'роль'}</strong><button type='button' onClick={() => setPanel(null)} aria-label='Закрыть уведомления'><X size={15} /></button></header>
          <div className='p7-mobile-notice-list'>
            {notices.map((item) => <Link key={item.href} href={item.href} onClick={() => setPanel(null)}><strong>{item.title}</strong><span>{item.note}</span></Link>)}
          </div>
        </section>
      ) : null}

      {panel === 'calculator' ? (
        <section className='p7-mobile-tool-panel p7-mobile-calc-panel' role='dialog' aria-label='Калькулятор'>
          <header><strong>Калькулятор</strong><button type='button' onClick={() => setPanel(null)} aria-label='Закрыть калькулятор'><X size={15} /></button></header>
          <div className='p7-mobile-calc-display'><span>{calcStored !== null ? `${formatCalc(calcStored)} ${calcOperator ?? '—'}` : 'Обычный расчёт'}</span><strong>{calcDisplay}</strong></div>
          <div className='p7-mobile-calc-grid'>
            <button type='button' onClick={clearCalc}>C</button>
            <button type='button' onClick={() => setCalcDisplay((value) => calcFresh || value.length <= 1 ? '0' : value.slice(0, -1))}><Delete size={15} /></button>
            {['÷', '×', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', ','].map((item) => (
              <button key={item} type='button' onClick={() => {
                if (item === ',') inputDecimal();
                else if (item === '=') calculate();
                else if (['+', '-', '×', '÷'].includes(item)) chooseCalcOperator(item);
                else inputCalc(item);
              }}>{item}</button>
            ))}
          </div>
        </section>
      ) : null}
    </>,
    mount,
  );
}

const css = `
@media(max-width:767px){
  html body .pc-shell-root-v4 .pc-v4-actions{overflow:visible!important}
  html body .pc-shell-root-v4 .pc-v4-actions > .p7-mobile-action-rail{display:grid!important;grid-template-columns:repeat(7,30px)!important;gap:3px!important;align-items:center!important;justify-content:end!important;inline-size:max-content!important;max-inline-size:100%!important;z-index:4!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;flex:0 0 auto!important;position:relative!important}
  html body .pc-shell-root-v4 .pc-v4-actions>.p7-note-widget,html body .pc-shell-root-v4 .pc-v4-actions>.p7-calc-widget,html body .pc-shell-root-v4 .pc-v4-actions>.pc-v7-notice-wrap{display:inline-flex!important;position:relative!important;width:0!important;min-width:0!important;max-width:0!important;height:0!important;min-height:0!important;max-height:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
  html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-search,html body .pc-shell-root-v4 .pc-v4-actions .pc-v4-theme-toggle,html body .pc-shell-root-v4 .pc-v4-actions .p7-role-support,html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-logout-btn,html body .pc-shell-root-v4 .pc-v4-actions .p7-note-widget>button,html body .pc-shell-root-v4 .pc-v4-actions .p7-calc-widget>button,html body .pc-shell-root-v4 .pc-v4-actions .pc-v7-notice-wrap>button,html body .pc-shell-root-v4 .pc-v4-actions button[aria-label='Открыть уведомления']{position:absolute!important;width:1px!important;min-width:1px!important;max-width:1px!important;height:1px!important;min-height:1px!important;max-height:1px!important;padding:0!important;margin:0!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
  html body .pc-shell-root-v4 .pc-v7-notice-panel,html body .pc-shell-root-v4 .p7-note-panel,html body .pc-shell-root-v4 .p7-calc-panel,html body .pc-shell-root-v4 .pc-v4-alert-panel{position:fixed!important;left:10px!important;right:10px!important;top:64px!important;width:auto!important;max-width:none!important;z-index:960!important;opacity:1!important;clip-path:none!important;pointer-events:auto!important}
  html body .p7-mobile-action-btn{inline-size:30px!important;block-size:30px!important;min-inline-size:30px!important;min-block-size:30px!important;max-inline-size:30px!important;max-block-size:30px!important;border-radius:11px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-card)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;text-decoration:none!important;box-shadow:var(--pc-shadow-sm)!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
  html body .p7-mobile-action-btn svg{inline-size:16px!important;block-size:16px!important;max-inline-size:16px!important;max-block-size:16px!important}
  html body .p7-mobile-action-logout{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}
  html body .p7-mobile-tool-panel{position:fixed!important;left:10px!important;right:10px!important;top:64px!important;z-index:990!important;display:grid!important;gap:10px!important;padding:12px!important;border:1px solid var(--pc-border)!important;border-radius:20px!important;background:var(--pc-bg-card)!important;box-shadow:var(--pc-shadow-lg)!important;color:var(--pc-text-primary)!important;max-height:calc(100dvh - 150px)!important;overflow:auto!important}
  html body .p7-mobile-tool-panel header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
  html body .p7-mobile-tool-panel header strong{font-size:14px!important;font-weight:950!important}
  html body .p7-mobile-tool-panel header button{inline-size:32px!important;block-size:32px!important;border-radius:12px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-secondary)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important}
  html body .p7-mobile-tool-panel textarea{inline-size:100%!important;min-height:240px!important;resize:vertical!important;border:1px solid var(--pc-border)!important;border-radius:17px!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-primary)!important;padding:12px!important;font-size:14px!important;line-height:1.45!important;font-weight:650!important;outline:none!important}
  html body .p7-mobile-tool-panel footer{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
  html body .p7-mobile-tool-panel footer span{font-size:11px!important;color:var(--pc-text-muted)!important;font-weight:800!important}
  html body .p7-mobile-tool-panel footer button{height:34px!important;padding:0 10px!important;border-radius:12px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-secondary)!important;font-size:12px!important;font-weight:900!important;display:inline-flex!important;align-items:center!important;gap:6px!important}
  html body .p7-mobile-tool-panel footer button:disabled{opacity:.45!important}
  html body .p7-mobile-notice-list{display:grid!important;gap:8px!important}
  html body .p7-mobile-notice-list a{display:grid!important;gap:4px!important;padding:10px 11px!important;border-radius:14px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;text-decoration:none!important;color:var(--pc-text-primary)!important}
  html body .p7-mobile-notice-list strong{font-size:12px!important;font-weight:950!important}.p7-mobile-notice-list span{font-size:11px!important;color:var(--pc-text-muted)!important;line-height:1.35!important}
  html body .p7-mobile-calc-display{min-height:76px!important;border:1px solid var(--pc-border)!important;border-radius:17px!important;background:var(--pc-bg-elevated)!important;padding:10px 12px!important;display:grid!important;align-content:center!important;justify-items:end!important;gap:4px!important}
  html body .p7-mobile-calc-display span{font-size:11px!important;color:var(--pc-text-muted)!important;font-weight:800!important}.p7-mobile-calc-display strong{font-size:30px!important;line-height:1!important;font-weight:950!important;letter-spacing:-.04em!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body .p7-mobile-calc-grid{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:7px!important}
  html body .p7-mobile-calc-grid button{height:42px!important;border-radius:14px!important;border:1px solid var(--pc-border)!important;background:var(--pc-bg-elevated)!important;color:var(--pc-text-primary)!important;font-size:16px!important;font-weight:900!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
}
@media(max-width:374px){
  html body .pc-shell-root-v4 .pc-v4-actions > .p7-mobile-action-rail{grid-template-columns:repeat(7,28px)!important;gap:2px!important}
  html body .p7-mobile-action-btn{inline-size:28px!important;block-size:28px!important;min-inline-size:28px!important;min-block-size:28px!important;max-inline-size:28px!important;max-block-size:28px!important}
  html body .p7-mobile-action-btn svg{inline-size:15px!important;block-size:15px!important}
}
`;
