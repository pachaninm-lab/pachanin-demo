'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NOTIFICATIONS } from '@/lib/v7r/data';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const roleLabels: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логист',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

const roleRoutes: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7r/driver',
  surveyor: '/platform-v7r/surveyor',
  elevator: '/platform-v7r/elevator',
  lab: '/platform-v7r/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7r/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7r/analytics',
};

const navByRole: Record<PlatformRole, Array<{ href: string; label: string }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Центр управления' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки' },
    { href: '/platform-v7/logistics', label: 'Логистика' },
    { href: '/platform-v7/bank', label: 'Банк' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/compliance', label: 'Комплаенс' },
    { href: '/platform-v7r/analytics', label: 'Сводка' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет покупателя' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/bank', label: 'Банковый контур' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет продавца' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/compliance', label: 'Документный след' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская' },
    { href: '/platform-v7/field', label: 'Поле и приёмка' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Инциденты' },
  ],
  driver: [
    { href: '/platform-v7r/driver', label: 'Мой маршрут' },
    { href: '/platform-v7/deals/DL-9103', label: 'Текущая сделка' },
    { href: '/platform-v7/logistics', label: 'Диспетчерская' },
  ],
  surveyor: [
    { href: '/platform-v7r/surveyor', label: 'Мои назначения' },
    { href: '/platform-v7/deals/DL-9102', label: 'Текущая сделка' },
    { href: '/platform-v7/disputes', label: 'Споры' },
  ],
  elevator: [
    { href: '/platform-v7r/elevator', label: 'Приёмка' },
    { href: '/platform-v7/logistics', label: 'Диспетчерская' },
    { href: '/platform-v7/deals', label: 'Сделки' },
  ],
  lab: [
    { href: '/platform-v7r/lab', label: 'Пробы и протоколы' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/deals', label: 'Сделки' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковый контур' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7r/analytics', label: 'Сводка' },
  ],
  arbitrator: [
    { href: '/platform-v7r/arbitrator', label: 'Комнаты разбора' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/compliance', label: 'Журнал действий' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Комплаенс' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7r/analytics', label: 'Сводка' },
  ],
  executive: [
    { href: '/platform-v7r/analytics', label: 'Сводка' },
    { href: '/platform-v7/control-tower', label: 'Центр управления' },
    { href: '/platform-v7/bank', label: 'Банк' },
    { href: '/platform-v7/disputes', label: 'Споры' },
  ],
};

const commandItems = [
  { href: '/platform-v7r/roles', label: 'Все роли', group: 'Навигация' },
  { href: '/platform-v7/control-tower', label: 'Центр управления', group: 'Навигация' },
  { href: '/platform-v7/deals', label: 'Сделки', group: 'Навигация' },
  { href: '/platform-v7/procurement', label: 'Закупки', group: 'Навигация' },
  { href: '/platform-v7/logistics', label: 'Логистика', group: 'Навигация' },
  { href: '/platform-v7/bank', label: 'Банк', group: 'Навигация' },
  { href: '/platform-v7/disputes', label: 'Споры', group: 'Навигация' },
  { href: '/platform-v7/compliance', label: 'Комплаенс', group: 'Навигация' },
  { href: '/platform-v7r/analytics', label: 'Сводка', group: 'Навигация' },
  { href: '/platform-v7/deals/DL-9102', label: 'Сделка DL-9102 · Пшеница · Спор', group: 'Сделки' },
  { href: '/platform-v7/deals/DL-9103', label: 'Сделка DL-9103 · Кукуруза · В пути', group: 'Сделки' },
  { href: '/platform-v7/deals/DL-9109', label: 'Сделка DL-9109 · Запрошена выплата', group: 'Сделки' },
  { href: '/platform-v7/disputes/DK-2024-89', label: 'Спор DK-2024-89 · Влажность', group: 'Споры' },
  { href: '/platform-v7r/driver', label: 'Переключить роль: Водитель', group: 'Роли', action: 'role:driver' },
  { href: '/platform-v7r/arbitrator', label: 'Переключить роль: Арбитр', group: 'Роли', action: 'role:arbitrator' },
  { href: '/platform-v7/buyer', label: 'Переключить роль: Покупатель', group: 'Роли', action: 'role:buyer' },
];

const breadcrumbLabels: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена',
  'platform-v7r': 'Прозрачная Цена',
  roles: 'Роли',
  'control-tower': 'Центр управления',
  deals: 'Сделки',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  field: 'Поле и приёмка',
  bank: 'Банк',
  disputes: 'Споры',
  compliance: 'Комплаенс',
  analytics: 'Сводка',
  procurement: 'Закупки',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  arbitrator: 'Арбитр',
};

const NOTIFICATIONS_DATA = [
  { id: 1, text: 'SLA alert: DK-2024-89 — ответ продавца просрочен', type: 'warning' as const, time: '14 мин назад', href: '/platform-v7r/arbitrator' },
  { id: 2, text: 'Спор DK-2024-91 открыт по весу', type: 'error' as const, time: '1 ч назад', href: '/platform-v7r/arbitrator' },
  { id: 3, text: 'Лаб. протокол ЛАБ-2851 подписан', type: 'success' as const, time: '2 ч назад', href: '/platform-v7r/lab' },
];

const NOTIF_ICON: Record<'warning' | 'error' | 'success', string> = { warning: '⚠️', error: '🔴', success: '✅' };

function buildBreadcrumbs(pathname: string) {
  const clean = pathname.split('?')[0];
  return clean
    .split('/')
    .filter(Boolean)
    .map((part, index, parts) => ({
      label: breadcrumbLabels[part] ?? part,
      href: '/' + parts.slice(0, index + 1).join('/'),
      isLast: index === parts.length - 1,
    }));
}

function Mark({ text }: { text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, fontSize: 11, fontWeight: 800 }}>
      {text}
    </span>
  );
}

function ShortcutsModal() {
  const { shortcutsOpen, setShortcutsOpen } = usePlatformV7RStore();
  if (!shortcutsOpen) return null;
  const items = [
    ['⌘K / Ctrl+K', 'Быстрый переход по платформе'],
    ['G + C', 'Центр управления'],
    ['G + D', 'Сделки'],
    ['G + L', 'Логистика'],
    ['G + B', 'Банк'],
    ['G + S', 'Споры'],
    ['R', 'Обновить страницу'],
    ['?', 'Показать это окно'],
    ['Esc', 'Закрыть модальное окно'],
  ];
  return (
    <div onClick={() => setShortcutsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#FFFFFF', borderRadius: 18, border: '1px solid #E4E6EA', padding: 22, boxShadow: '0 18px 48px rgba(9,30,66,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0F1419' }}>Сочетания клавиш</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Быстрая навигация и действия на платформе.</div>
          </div>
          <button onClick={() => setShortcutsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }} aria-label="Закрыть">×</button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(([keys, label]) => (
            <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>{keys}</span>
              <span style={{ fontSize: 12, color: '#6B778C' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickJump() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, setRole } = usePlatformV7RStore();
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => { if (!commandOpen) { setQuery(''); setSelected(0); } }, [commandOpen]);

  const filtered = commandItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.href.toLowerCase().includes(query.toLowerCase())
  );

  const groups = Array.from(new Set(filtered.map(i => i.group)));

  if (!commandOpen) return null;

  function handleSelect(item: typeof commandItems[number]) {
    if (item.action?.startsWith('role:')) {
      const role = item.action.split(':')[1] as PlatformRole;
      setRole(role);
    }
    router.push(item.href);
    setCommandOpen(false);
  }

  return (
    <div onClick={() => setCommandOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(15,20,25,0.42)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '78px 16px 16px' }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#FFFFFF', borderRadius: 18, border: '1px solid #E4E6EA', overflow: 'hidden', boxShadow: '0 18px 48px rgba(9,30,66,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #E4E6EA' }}>
          <Mark text="⌕" />
          <input
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && filtered[selected]) handleSelect(filtered[selected]);
              if (e.key === 'Escape') setCommandOpen(false);
            }}
            placeholder="Найти экран, сделку, спор или кабинет..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F1419', background: 'transparent' }}
          />
          <button onClick={() => setCommandOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16 }} aria-label="Закрыть">×</button>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {groups.map(group => {
            const groupItems = filtered.filter(i => i.group === group);
            return (
              <div key={group}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group}</div>
                {groupItems.map((item, gi) => {
                  const globalIndex = filtered.indexOf(item);
                  return (
                    <button
                      key={item.href + item.label}
                      onClick={() => handleSelect(item)}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none',
                        background: globalIndex === selected ? '#F0FDF4' : 'transparent',
                        cursor: 'pointer', padding: '12px 16px',
                        borderBottom: gi < groupItems.length - 1 ? '1px solid #F8FAFB' : 'none',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.href}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileBar({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #E4E6EA', padding: '8px 10px calc(env(safe-area-inset-bottom, 0px) + 8px)', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none', padding: '8px 10px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, flexShrink: 0, background: active ? '#0A7A5F' : '#F5F7F8', color: active ? '#fff' : '#495057', border: active ? '1px solid transparent' : '1px solid #E4E6EA' }}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, demoMode, sidebarOpen, notificationsOpen, unreadNotifications, setRole, clearRoleSelection, setDemoMode, setSidebarOpen, setCommandOpen, setShortcutsOpen, setNotificationsOpen, setUnreadNotifications } = usePlatformV7RStore();
  const [readAll, setReadAll] = React.useState(false);

  React.useEffect(() => {
    const state = { waitingForSecondKey: false, timer: 0 as unknown as number };
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') { event.preventDefault(); setCommandOpen(true); return; }
      if (key === '?') { event.preventDefault(); setShortcutsOpen(true); return; }
      if (key === 'escape') { setCommandOpen(false); setShortcutsOpen(false); setNotificationsOpen(false); return; }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'r') {
        const tagName = (event.target as HTMLElement | null)?.tagName;
        if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT') { event.preventDefault(); router.refresh(); }
      }
      if (key === 'g') { state.waitingForSecondKey = true; window.clearTimeout(state.timer); state.timer = window.setTimeout(() => { state.waitingForSecondKey = false; }, 1200); return; }
      if (state.waitingForSecondKey) {
        if (key === 'd') router.push('/platform-v7/deals');
        if (key === 'c') router.push('/platform-v7/control-tower');
        if (key === 'b') router.push('/platform-v7/bank');
        if (key === 's') router.push('/platform-v7/disputes');
        if (key === 'l') router.push('/platform-v7/logistics');
        state.waitingForSecondKey = false;
        window.clearTimeout(state.timer);
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); window.clearTimeout(state.timer); };
  }, [router, setCommandOpen, setNotificationsOpen, setShortcutsOpen]);

  React.useEffect(() => { setSidebarOpen(false); }, [pathname, setSidebarOpen]);

  const navItems = navByRole[role];
  const breadcrumbs = buildBreadcrumbs(pathname);
  const notifCount = readAll ? 0 : (unreadNotifications > 0 ? unreadNotifications : 0);

  return (
    <div className="v9-root" style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #F7FAFB 0%, #F1F5F7 100%)' }}>
      <a href="#main-content" style={{ position: 'absolute', left: 12, top: -50, zIndex: 200, background: '#0A7A5F', color: '#FFFFFF', padding: '10px 12px', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700 }} onFocus={(event) => { event.currentTarget.style.top = '12px'; }} onBlur={(event) => { event.currentTarget.style.top = '-50px'; }}>Перейти к содержанию</a>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.36)', zIndex: 79 }} aria-hidden />}

      <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: 290, maxWidth: '84vw', zIndex: 80, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease', background: '#FFFFFF', borderRight: '1px solid #E4E6EA', boxShadow: sidebarOpen ? '0 16px 40px rgba(9,30,66,0.14)' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 18, borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Прозрачная Цена</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B778C', marginTop: 3 }}>Исполнение сделки · v7</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, fontSize: 18 }} aria-label="Закрыть меню">×</button>
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'linear-gradient(180deg, rgba(10,122,95,0.08) 0%, rgba(10,122,95,0.03) 100%)', border: '1px solid rgba(10,122,95,0.14)' }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Текущий кабинет</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A7A5F', marginTop: 4 }}>{roleLabels[role]}</div>
          </div>
        </div>
        <nav style={{ padding: 12, display: 'grid', gap: 4, overflowY: 'auto' }}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 600, background: active ? 'rgba(10,122,95,0.09)' : 'transparent', color: active ? '#0A7A5F' : '#1F2937', border: active ? '1px solid rgba(10,122,95,0.14)' : '1px solid transparent' }}>{item.label}</Link>;
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid #E4E6EA', display: 'grid', gap: 8 }}>
          <Link href="/platform-v7r/roles" onClick={() => { clearRoleSelection(); setSidebarOpen(false); }} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все роли</Link>
          <button onClick={() => setDemoMode(!demoMode)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: demoMode ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)', border: `1px solid ${demoMode ? 'rgba(217,119,6,0.18)' : 'rgba(22,163,74,0.18)'}`, color: demoMode ? '#B45309' : '#15803D', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{demoMode ? 'Демо-контур включён' : 'Живой режим включён'}</button>
        </div>
      </aside>

      <div style={{ paddingBottom: 72 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 60, padding: '12px 12px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', maxWidth: 1360, margin: '0 auto' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 10, padding: 10, cursor: 'pointer' }} aria-label="Открыть меню"><Mark text="≡" /></button>
            <div style={{ minWidth: 0 }}>
              <nav aria-label="Хлебные крошки" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <span style={{ color: '#9AA4B2', fontSize: 12 }}>/</span>}
                    {crumb.isLast
                      ? <span style={{ fontSize: 13, fontWeight: 800, color: '#0F1419', whiteSpace: 'nowrap' }}>{crumb.label}</span>
                      : <Link href={crumb.href} style={{ textDecoration: 'none', color: '#6B778C', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{crumb.label}</Link>}
                  </React.Fragment>
                ))}
              </nav>
              <div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>{roleLabels[role]} · {demoMode ? 'демо-контур' : 'живой режим'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setCommandOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F5F7F8', border: '1px solid #E4E6EA', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }} aria-label="Быстрый переход"><Mark text="⌕" /><span style={{ fontSize: 12, color: '#495057', fontWeight: 700 }}>Найти</span></button>
              <button onClick={() => setShortcutsOpen(true)} style={{ background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 10, padding: 8, cursor: 'pointer' }} aria-label="Сочетания клавиш"><Mark text="?" /></button>
              <button
                onClick={() => {
                  const next = !notificationsOpen;
                  setNotificationsOpen(next);
                  if (next) { setReadAll(false); }
                  if (!next && !readAll && unreadNotifications > 0) setUnreadNotifications(0);
                }}
                style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 10, padding: 8, cursor: 'pointer' }}
                aria-label="Уведомления">
                <Mark text="•" />
                {notifCount > 0 && !readAll ? (
                  <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 999, background: '#DC2626', color: '#FFFFFF', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifCount}</span>
                ) : null}
              </button>
            </div>
          </div>

          <div style={{ maxWidth: 1360, margin: '10px auto 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <select
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value as PlatformRole;
                setRole(nextRole);
                router.push(roleRoutes[nextRole]);
              }}
              style={{ minWidth: 160, border: '1px solid #E4E6EA', borderRadius: 10, padding: '8px 12px', fontSize: 13, background: '#FFFFFF' }}>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Link href="/platform-v7r/roles" onClick={() => clearRoleSelection()} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>Все роли</Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${demoMode ? 'rgba(217,119,6,0.18)' : 'rgba(22,163,74,0.18)'}`, background: demoMode ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)', color: demoMode ? '#B45309' : '#15803D', fontSize: 12, fontWeight: 800 }}>
              {demoMode ? 'ДЕМО-КОНТУР' : 'ЖИВОЙ РЕЖИМ'}
              <button onClick={() => setDemoMode(!demoMode)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'inherit', fontSize: 12, fontWeight: 800, padding: 0 }}>{demoMode ? 'Переключить' : 'Вернуть демо'}</button>
            </div>
          </div>
        </header>

        {/* Notifications dropdown */}
        {notificationsOpen && (
          <div style={{ position: 'fixed', top: 130, right: 12, width: 'min(360px, calc(100vw - 24px))', background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 16, zIndex: 100, boxShadow: '0 16px 40px rgba(9,30,66,0.16)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Уведомления</div>
              <button onClick={() => { setReadAll(true); setUnreadNotifications(0); }} style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Отметить все прочитанными</button>
            </div>
            {NOTIFICATIONS_DATA.map((item) => (
              <Link key={item.id} href={item.href} onClick={() => setNotificationsOpen(false)} style={{ display: 'flex', gap: 10, textDecoration: 'none', padding: '12px 16px', borderBottom: '1px solid #F1F3F5', color: '#0F1419', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{NOTIF_ICON[item.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{item.text}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{item.time}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <main id="main-content" style={{ padding: 16, maxWidth: 1360, margin: '0 auto' }}>{children}</main>
      </div>

      <QuickJump />
      <ShortcutsModal />
      <MobileBar items={navItems} />
    </div>
  );
}
