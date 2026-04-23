'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PLATFORM_V7_LEXICON } from '@/lib/platform-v7/lexicon';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: PLATFORM_V7_LEXICON.nav.driver,
  surveyor: 'Сюрвейер',
  elevator: PLATFORM_V7_LEXICON.nav.elevator,
  lab: PLATFORM_V7_LEXICON.nav.lab,
  bank: PLATFORM_V7_LEXICON.nav.bank,
  arbitrator: 'Арбитр',
  compliance: PLATFORM_V7_LEXICON.nav.compliance,
  executive: 'Руководитель',
};

const ROLE_STAGE: Record<PlatformRole, { label: string; bg: string; border: string; color: string }> = {
  operator: { label: PLATFORM_V7_LEXICON.env.pilot, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  buyer: { label: PLATFORM_V7_LEXICON.env.pilot, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  seller: { label: PLATFORM_V7_LEXICON.env.pilot, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  logistics: { label: PLATFORM_V7_LEXICON.env.pilot, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  bank: { label: PLATFORM_V7_LEXICON.env.sandbox, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  compliance: { label: PLATFORM_V7_LEXICON.env.sandbox, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  driver: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
  surveyor: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
  elevator: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
  lab: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
  arbitrator: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
  executive: { label: PLATFORM_V7_LEXICON.env.demo, bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' },
};

const ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/analytics',
};

const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: PLATFORM_V7_LEXICON.nav.controlTower },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/lots', label: PLATFORM_V7_LEXICON.nav.lots },
    { href: '/platform-v7/operator-cockpit/queues', label: 'Очереди' },
    { href: '/platform-v7/logistics', label: PLATFORM_V7_LEXICON.nav.logistics },
    { href: '/platform-v7/bank', label: PLATFORM_V7_LEXICON.nav.bank },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
    { href: '/platform-v7/compliance', label: PLATFORM_V7_LEXICON.nav.compliance },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет' },
    { href: '/platform-v7/procurement', label: PLATFORM_V7_LEXICON.nav.procurement },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
    { href: '/platform-v7/bank', label: 'Деньги' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет' },
    { href: '/platform-v7/lots', label: PLATFORM_V7_LEXICON.nav.lots },
    { href: '/platform-v7/lots/create', label: 'Создать лот' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская' },
    { href: '/platform-v7/field', label: 'Поле и приёмка' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: 'Инциденты' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Маршрут' },
    { href: '/platform-v7/deals/DL-9103', label: 'Сделка' },
    { href: '/platform-v7/field', label: 'Полевой контур' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Назначения' },
    { href: '/platform-v7/deals/DL-9102', label: 'Сделка' },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
  ],
  elevator: [
    { href: '/platform-v7/elevator', label: 'Приёмка' },
    { href: '/platform-v7/logistics', label: 'Рейсы' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
  ],
  lab: [
    { href: '/platform-v7/lab', label: 'Пробы' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковый контур' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: 'Удержания и споры' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Разбор' },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Допуск и аудит' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes },
  ],
  executive: [
    { href: '/platform-v7/analytics', label: 'Сводка' },
    { href: '/platform-v7/control-tower', label: PLATFORM_V7_LEXICON.nav.controlTower },
    { href: '/platform-v7/bank', label: 'Деньги' },
    { href: '/platform-v7/disputes', label: 'Риски' },
  ],
};

const CRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена',
  roles: PLATFORM_V7_LEXICON.nav.roles,
  'role-hub': PLATFORM_V7_LEXICON.nav.roles,
  'control-tower': PLATFORM_V7_LEXICON.nav.controlTower,
  deals: PLATFORM_V7_LEXICON.nav.deals,
  lots: PLATFORM_V7_LEXICON.nav.lots,
  create: 'Создание',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: PLATFORM_V7_LEXICON.nav.logistics,
  field: 'Поле и приёмка',
  bank: PLATFORM_V7_LEXICON.nav.bank,
  disputes: PLATFORM_V7_LEXICON.nav.disputes,
  compliance: PLATFORM_V7_LEXICON.nav.compliance,
  analytics: 'Сводка',
  procurement: PLATFORM_V7_LEXICON.nav.procurement,
  driver: PLATFORM_V7_LEXICON.nav.driver,
  surveyor: 'Сюрвейер',
  elevator: PLATFORM_V7_LEXICON.nav.elevator,
  lab: PLATFORM_V7_LEXICON.nav.lab,
  arbitrator: 'Арбитр',
  connectors: PLATFORM_V7_LEXICON.nav.connectors,
  'operator-cockpit': 'Оператор',
  queues: 'Очереди',
  auctions: 'Торги',
  investor: PLATFORM_V7_LEXICON.nav.investor,
  demo: PLATFORM_V7_LEXICON.nav.demo,
};

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({
    href: '/' + parts.slice(0, index + 1).join('/'),
    label: CRUMB_LABELS[part] ?? part,
    isLast: index === parts.length - 1,
  }));
}

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, clearRoleSelection } = usePlatformV7RStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const items = NAV_BY_ROLE[role];
  const stage = ROLE_STAGE[role];
  const crumbs = breadcrumbs(pathname);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="v9-root" style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #F7FAFB 0%, #F1F5F7 100%)' }}>
      <a href="#main-content" style={{ position: 'absolute', left: 12, top: -50, zIndex: 200, background: '#0A7A5F', color: '#FFFFFF', padding: '10px 12px', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700 }} onFocus={(event) => { event.currentTarget.style.top = '12px'; }} onBlur={(event) => { event.currentTarget.style.top = '-50px'; }}>Перейти к содержанию</a>

      {sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.36)', zIndex: 79 }} aria-hidden /> : null}

      <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: 290, maxWidth: '84vw', zIndex: 80, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease', background: '#FFFFFF', borderRight: '1px solid #E4E6EA', boxShadow: sidebarOpen ? '0 16px 40px rgba(9,30,66,0.14)' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 18, borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Прозрачная Цена</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B778C', marginTop: 3 }}>Единый контур сделки</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, fontSize: 18 }} aria-label="Закрыть меню">×</button>
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Текущий кабинет</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{ROLE_LABELS[role]}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{stage.label}</span>
            </div>
          </div>
        </div>

        <nav style={{ padding: 12, display: 'grid', gap: 4, overflowY: 'auto' }}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 600, background: active ? 'rgba(10,122,95,0.09)' : 'transparent', color: active ? '#0A7A5F' : '#1F2937', border: active ? '1px solid rgba(10,122,95,0.14)' : '1px solid transparent' }}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid #E4E6EA', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link href="/platform-v7/investor" onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{PLATFORM_V7_LEXICON.nav.investor}</Link>
            <Link href="/platform-v7/demo" onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{PLATFORM_V7_LEXICON.nav.demo}</Link>
          </div>
          <Link href="/platform-v7/roles" onClick={() => { clearRoleSelection(); setSidebarOpen(false); }} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>{PLATFORM_V7_LEXICON.nav.roles}</Link>
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(217,119,6,0.18)', background: 'rgba(217,119,6,0.08)', color: '#B45309', fontSize: 12, lineHeight: 1.6 }}>
            Платформа честно показывает режим роли: пилотный режим, тестовая среда или демо-данные. Боевой контур не заявляется без подтверждённых подключений.
          </div>
        </div>
      </aside>

      <div style={{ paddingBottom: 76 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 60, padding: '12px 12px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', maxWidth: 1360, margin: '0 auto' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 10, padding: 10, cursor: 'pointer' }} aria-label="Открыть меню">≡</button>
            <div style={{ minWidth: 0 }}>
              <nav aria-label="Хлебные крошки" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {crumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 ? <span style={{ color: '#9AA4B2', fontSize: 12 }}>/</span> : null}
                    {crumb.isLast ? <span style={{ fontSize: 13, fontWeight: 800, color: '#0F1419', whiteSpace: 'nowrap' }}>{crumb.label}</span> : <Link href={crumb.href} style={{ textDecoration: 'none', color: '#6B778C', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{crumb.label}</Link>}
                  </React.Fragment>
                ))}
              </nav>
              <div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>{ROLE_LABELS[role]} · {stage.label}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link href="/platform-v7/investor" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{PLATFORM_V7_LEXICON.nav.investor}</Link>
              <Link href="/platform-v7/demo" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{PLATFORM_V7_LEXICON.nav.demo}</Link>
              <Link href="/platform-v7/roles" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{PLATFORM_V7_LEXICON.nav.roles}</Link>
            </div>
          </div>

          <div style={{ maxWidth: 1360, margin: '10px auto 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <select value={role} onChange={(event) => { const nextRole = event.target.value as PlatformRole; setRole(nextRole); router.push(ROLE_ROUTES[nextRole]); }} style={{ minWidth: 180, border: '1px solid #E4E6EA', borderRadius: 10, padding: '8px 12px', fontSize: 13, background: '#FFFFFF' }}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${stage.border}`, background: stage.bg, color: stage.color, fontSize: 12, fontWeight: 800 }}>
              {stage.label}
            </div>
          </div>
        </header>

        <main id="main-content" style={{ padding: 16, maxWidth: 1360, margin: '0 auto' }}>{children}</main>
      </div>

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
    </div>
  );
}
