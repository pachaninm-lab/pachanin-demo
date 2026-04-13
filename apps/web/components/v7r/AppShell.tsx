'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, Search, Bot, X } from 'lucide-react';
import { NOTIFICATIONS } from '@/lib/v7r/data';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const roleLabels: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  driver: 'Поле',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
};

const roleRoutes: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  driver: '/platform-v7/field',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/disputes',
  compliance: '/platform-v7/compliance',
};

const navByRole: Record<PlatformRole, Array<{ href: string; label: string }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Control Tower' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки (RFQ)' },
    { href: '/platform-v7/bank', label: 'Банк' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/field', label: 'Поле' },
    { href: '/platform-v7/compliance', label: 'Комплаенс' },
    { href: '/platform-v7/analytics', label: 'Аналитика' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Покупатель' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки (RFQ)' },
    { href: '/platform-v7/disputes', label: 'Споры' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Продавец' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки (RFQ)' },
    { href: '/platform-v7/disputes', label: 'Споры' },
  ],
  driver: [
    { href: '/platform-v7/field', label: 'Поле' },
    { href: '/platform-v7/deals/DL-9102', label: 'Текущая сделка' },
    { href: '/platform-v7/disputes', label: 'Споры' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банк' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/analytics', label: 'Аналитика' },
  ],
  arbitrator: [
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/deals', label: 'Сделки' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Комплаенс' },
    { href: '/platform-v7/deals', label: 'Сделки' },
    { href: '/platform-v7/disputes', label: 'Споры' },
    { href: '/platform-v7/analytics', label: 'Аналитика' },
  ],
};

const commandItems = [
  { href: '/platform-v7/control-tower', label: 'Control Tower' },
  { href: '/platform-v7/deals', label: 'Сделки' },
  { href: '/platform-v7/deals/DL-9102', label: 'DL-9102' },
  { href: '/platform-v7/disputes', label: 'Споры' },
  { href: '/platform-v7/disputes/DK-2024-89', label: 'DK-2024-89' },
  { href: '/platform-v7/bank', label: 'Банк' },
  { href: '/platform-v7/analytics', label: 'Аналитика' },
  { href: '/platform-v7/procurement', label: 'Закупки (RFQ)' },
];

function buildBreadcrumbs(pathname: string) {
  const labels: Record<string, string> = {
    'platform-v7': 'Платформа',
    'control-tower': 'Control Tower',
    'deals': 'Сделки',
    'buyer': 'Покупатель',
    'seller': 'Продавец',
    'bank': 'Банк',
    'disputes': 'Споры',
    'field': 'Поле',
    'compliance': 'Комплаенс',
    'analytics': 'Аналитика',
    'procurement': 'Закупки',
  };
  return pathname.split('/').filter(Boolean).map((part, index, arr) => ({
    label: labels[part] ?? part,
    href: '/' + arr.slice(0, index + 1).join('/'),
    isLast: index === arr.length - 1,
  }));
}

function ShortcutsModal() {
  const { shortcutsOpen, setShortcutsOpen } = usePlatformV7RStore();
  if (!shortcutsOpen) return null;
  const items = [
    ['⌘K', 'Поиск по платформе'],
    ['R', 'Обновить данные'],
    ['Esc', 'Закрыть окно'],
    ['G+D', 'Перейти в Сделки'],
    ['G+C', 'Перейти в Control Tower'],
    ['G+B', 'Перейти в Банк'],
    ['G+S', 'Перейти в Споры'],
  ];
  return (
    <div onClick={() => setShortcutsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 12, border: '1px solid #E4E6EA', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Горячие клавиши</h2>
          <button onClick={() => setShortcutsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {items.map(([key, text]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#FAFAFA', border: '1px solid #E4E6EA' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{key}</span>
              <span style={{ color: '#6B778C', fontSize: 12 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen } = usePlatformV7RStore();
  const [query, setQuery] = React.useState('');
  const filtered = commandItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  if (!commandOpen) return null;
  return (
    <div onClick={() => setCommandOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(15,20,25,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 96 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 12, border: '1px solid #E4E6EA', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #E4E6EA' }}>
          <Search size={16} color="#6B778C" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по платформе..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14 }} />
          <button onClick={() => setCommandOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Закрыть"><X size={16} /></button>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.map((item) => (
            <button key={item.href} onClick={() => { router.push(item.href); setCommandOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{item.href}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    role,
    demoMode,
    sidebarOpen,
    notificationsOpen,
    unreadNotifications,
    setRole,
    setDemoMode,
    setSidebarOpen,
    setCommandOpen,
    setShortcutsOpen,
    setNotificationsOpen,
    setUnreadNotifications,
  } = usePlatformV7RStore();

  React.useEffect(() => {
    const gRef = { value: 0 };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && key === 'r') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          router.refresh();
        }
      }
      if (key === 'g') {
        gRef.value = Date.now();
      } else if (gRef.value && Date.now() - gRef.value < 1200) {
        if (key === 'd') router.push('/platform-v7/deals');
        if (key === 'c') router.push('/platform-v7/control-tower');
        if (key === 'b') router.push('/platform-v7/bank');
        if (key === 's') router.push('/platform-v7/disputes');
        gRef.value = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, setCommandOpen, setShortcutsOpen]);

  const breadcrumbs = buildBreadcrumbs(pathname);
  const navItems = navByRole[role];

  return (
    <div className="v9-root" style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #F8FAFB 0%, #F2F5F7 100%)' }}>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.35)', zIndex: 39 }} />}
      <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: 280, background: '#fff', borderRight: '1px solid #E4E6EA', zIndex: 40, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Прозрачная Цена</div>
          <div style={{ fontSize: 10, color: '#6B778C', letterSpacing: '0.08em', fontWeight: 700 }}>PLATFORM</div>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #E4E6EA', background: 'rgba(10,122,95,0.03)' }}>
          <div style={{ fontSize: 11, color: '#6B778C' }}>Текущая роль</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{roleLabels[role]}</div>
        </div>
        <nav style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 8, background: active ? 'rgba(10,122,95,0.08)' : 'transparent', color: active ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: active ? 700 : 500 }}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div style={{ marginLeft: 0 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E4E6EA' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }} aria-label="Открыть меню"><Menu size={18} /></button>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.href}>
                {idx > 0 && <span style={{ color: '#6B778C', fontSize: 12 }}>/</span>}
                {crumb.isLast ? <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb.label}</span> : <Link href={crumb.href} style={{ fontSize: 13, color: '#6B778C', textDecoration: 'none' }}>{crumb.label}</Link>}
              </React.Fragment>
            ))}
          </nav>
          <button onClick={() => setCommandOpen(true)} style={{ background: '#F4F5F7', border: '1px solid #E4E6EA', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} aria-label="Поиск"><Search size={14} /><span style={{ fontSize: 12, color: '#6B778C' }}>Поиск</span></button>
          <button onClick={() => setShortcutsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }} aria-label="Горячие клавиши"><Bot size={18} /></button>
          <button onClick={() => { setNotificationsOpen(!notificationsOpen); if (unreadNotifications > 0) setUnreadNotifications(0); }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }} aria-label="Уведомления"><Bell size={18} />{unreadNotifications > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#DC2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{unreadNotifications}</span>}</button>
          <select value={role} onChange={(e) => { const nextRole = e.target.value as PlatformRole; setRole(nextRole); router.push(roleRoutes[nextRole]); }} style={{ border: '1px solid #E4E6EA', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {demoMode && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', fontSize: 11, fontWeight: 700, color: '#D97706' }}>SANDBOX<button onClick={() => setDemoMode(false)} style={{ background: 'none', border: 'none', color: '#6B778C', textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}>Выйти</button></div>}
        </header>
        {notificationsOpen && <div style={{ position: 'fixed', top: 64, right: 16, width: 360, background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, zIndex: 60, boxShadow: '0 12px 36px rgba(9,30,66,0.18)' }}>{NOTIFICATIONS.map((item) => <Link key={item.id} href={item.href} style={{ display: 'block', textDecoration: 'none', padding: '12px 14px', borderBottom: '1px solid #F4F5F7', color: '#0F1419', fontSize: 13 }}>{item.text}</Link>)}</div>}
        <main id="main-content" style={{ padding: 16, maxWidth: 1360, margin: '0 auto' }}>{children}</main>
      </div>
      <CommandPalette />
      <ShortcutsModal />
    </div>
  );
}
