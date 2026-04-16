'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборатория', bank: 'Банк', arbitrator: 'Арбитр', compliance: 'Комплаенс', executive: 'Руководитель',
};

const ROLE_STAGE: Record<PlatformRole, { label: string; tone: 'pilot' | 'sandbox' | 'simulation' }> = {
  operator: { label: 'ПИЛОТ', tone: 'pilot' }, buyer: { label: 'ПИЛОТ', tone: 'pilot' }, seller: { label: 'ПИЛОТ', tone: 'pilot' }, logistics: { label: 'ПИЛОТ', tone: 'pilot' }, bank: { label: 'ПЕСОЧНИЦА', tone: 'sandbox' }, compliance: { label: 'ПЕСОЧНИЦА', tone: 'sandbox' }, driver: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' }, surveyor: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' }, elevator: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' }, lab: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' }, arbitrator: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' }, executive: { label: 'СИМУЛЯЦИЯ', tone: 'simulation' },
};

const ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower', buyer: '/platform-v7/buyer', seller: '/platform-v7/seller', logistics: '/platform-v7/logistics', driver: '/platform-v7/driver', surveyor: '/platform-v7/surveyor', elevator: '/platform-v7/elevator', lab: '/platform-v7/lab', bank: '/platform-v7/bank', arbitrator: '/platform-v7/arbitrator', compliance: '/platform-v7/compliance', executive: '/platform-v7/analytics',
};

const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string }>> = {
  operator: [{ href: '/platform-v7/control-tower', label: 'Центр управления' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/lots', label: 'Лоты' }, { href: '/platform-v7/logistics', label: 'Логистика' }, { href: '/platform-v7/connectors', label: 'Интеграции' }, { href: '/platform-v7/bank', label: 'Банк' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  buyer: [{ href: '/platform-v7/buyer', label: 'Кабинет' }, { href: '/platform-v7/procurement', label: 'Закупки' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/bank', label: 'Деньги' }],
  seller: [{ href: '/platform-v7/seller', label: 'Кабинет' }, { href: '/platform-v7/lots', label: 'Лоты' }, { href: '/platform-v7/lots/create', label: 'Создать лот' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  logistics: [{ href: '/platform-v7/logistics', label: 'Диспетчерская' }, { href: '/platform-v7/driver', label: 'Водитель' }, { href: '/platform-v7/elevator', label: 'Приёмка' }, { href: '/platform-v7/lab', label: 'Лаборатория' }],
  driver: [{ href: '/platform-v7/driver', label: 'Маршрут' }, { href: '/platform-v7/deals/DL-9103', label: 'Сделка' }],
  surveyor: [{ href: '/platform-v7/surveyor', label: 'Назначения' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  elevator: [{ href: '/platform-v7/elevator', label: 'Приёмка' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  lab: [{ href: '/platform-v7/lab', label: 'Пробы' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  bank: [{ href: '/platform-v7/bank', label: 'Банковый контур' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/disputes', label: 'Удержания и споры' }],
  arbitrator: [{ href: '/platform-v7/arbitrator', label: 'Разбор' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  compliance: [{ href: '/platform-v7/compliance', label: 'Допуск' }, { href: '/platform-v7/connectors', label: 'Интеграции' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  executive: [{ href: '/platform-v7/analytics', label: 'Сводка' }, { href: '/platform-v7/control-tower', label: 'Центр управления' }, { href: '/platform-v7/bank', label: 'Деньги' }],
};

const CRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена', 'control-tower': 'Центр управления', deals: 'Сделки', lots: 'Лоты', create: 'Создание', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', field: 'Поле и приёмка', bank: 'Банк', disputes: 'Споры', compliance: 'Комплаенс', analytics: 'Сводка', procurement: 'Закупки', driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборатория', arbitrator: 'Арбитр', connectors: 'Интеграции', investor: 'Режим инвестора', demo: 'Демо-сценарий'
};

function badgeColors(tone: 'pilot' | 'sandbox' | 'simulation') {
  if (tone === 'pilot') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'sandbox') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' };
}

function modeMeta(pathname: string) {
  if (pathname.startsWith('/platform-v7/investor')) return { label: 'РЕЖИМ ИНВЕСТОРА', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' };
  if (pathname.startsWith('/platform-v7/demo')) return { label: 'ДЕМО-СЦЕНАРИЙ', bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.18)', color: '#7C3AED' };
  return { label: 'ОСНОВНОЙ РЕЖИМ', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
}

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({ href: '/' + parts.slice(0, index + 1).join('/'), label: CRUMB_LABELS[part] ?? part, isLast: index === parts.length - 1 }));
}

export function AppShellV3({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, clearRoleSelection } = usePlatformV7RStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const items = NAV_BY_ROLE[role];
  const stage = ROLE_STAGE[role];
  const stageColors = badgeColors(stage.tone);
  const mode = modeMeta(pathname);
  const crumbs = breadcrumbs(pathname);

  React.useEffect(() => { setSidebarOpen(false); }, [pathname]);

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #F7FAFB 0%, #F1F5F7 100%)' }}>
      {sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.36)', zIndex: 79 }} aria-hidden /> : null}
      <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: 286, maxWidth: '84vw', zIndex: 80, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease', background: '#FFFFFF', borderRight: '1px solid #E4E6EA', boxShadow: sidebarOpen ? '0 16px 40px rgba(9,30,66,0.14)' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 18, borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#0F1419' }}>Прозрачная Цена</div>
              <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>Цифровой контур исполнения сделки</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Текущий кабинет</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{ROLE_LABELS[role]}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: stageColors.bg, border: `1px solid ${stageColors.border}`, color: stageColors.color, fontSize: 10, fontWeight: 800 }}>{stage.label}</span>
            </div>
          </div>
        </div>
        <nav style={{ padding: 12, display: 'grid', gap: 4, overflowY: 'auto' }}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 600, background: active ? 'rgba(10,122,95,0.09)' : 'transparent', color: active ? '#0A7A5F' : '#1F2937', border: active ? '1px solid rgba(10,122,95,0.14)' : '1px solid transparent' }}>{item.label}</Link>;
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid #E4E6EA', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link href='/platform-v7/investor' style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Режим инвестора</Link>
            <Link href='/platform-v7/demo' style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Демо-сценарий</Link>
          </div>
          <Link href='/platform-v7/roles' onClick={() => { clearRoleSelection(); setSidebarOpen(false); }} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: '#F5F7F8', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все роли</Link>
        </div>
      </aside>
      <div style={{ paddingBottom: 76 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 60, padding: '12px 12px', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ maxWidth: 1360, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 10, padding: 10, cursor: 'pointer' }}>≡</button>
            <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
              <nav style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {crumbs.map((crumb, index) => <React.Fragment key={crumb.href}>{index > 0 ? <span style={{ color: '#9AA4B2', fontSize: 12 }}>/</span> : null}{crumb.isLast ? <span style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{crumb.label}</span> : <Link href={crumb.href} style={{ textDecoration: 'none', color: '#6B778C', fontSize: 12, fontWeight: 600 }}>{crumb.label}</Link>}</React.Fragment>)}
              </nav>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: mode.bg, border: `1px solid ${mode.border}`, color: mode.color, fontSize: 11, fontWeight: 800 }}>{mode.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: stageColors.bg, border: `1px solid ${stageColors.border}`, color: stageColors.color, fontSize: 11, fontWeight: 800 }}>{ROLE_LABELS[role]} · {stage.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link href='/platform-v7/connectors' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>Интеграции</Link>
              <Link href='/platform-v7/investor' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>Инвестор</Link>
              <Link href='/platform-v7/demo' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#FFFFFF', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>Демо</Link>
            </div>
          </div>
          <div style={{ maxWidth: 1360, margin: '10px auto 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <select value={role} onChange={(event) => { const nextRole = event.target.value as PlatformRole; setRole(nextRole); router.push(ROLE_ROUTES[nextRole]); }} style={{ minWidth: 180, border: '1px solid #E4E6EA', borderRadius: 10, padding: '8px 12px', fontSize: 13, background: '#FFFFFF' }}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </header>
        <main style={{ padding: 16, maxWidth: 1360, margin: '0 auto' }}>{children}</main>
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #E4E6EA', padding: '8px 10px calc(env(safe-area-inset-bottom, 0px) + 8px)', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {items.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + '/'); return <Link key={item.href} href={item.href} style={{ textDecoration: 'none', padding: '8px 10px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, flexShrink: 0, background: active ? '#0A7A5F' : '#F5F7F8', color: active ? '#fff' : '#495057', border: active ? '1px solid transparent' : '1px solid #E4E6EA' }}>{item.label}</Link>; })}
      </div>
    </div>
  );
}
