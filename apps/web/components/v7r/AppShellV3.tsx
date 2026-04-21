'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Bell, Search, X, Moon, Sun } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { NOTIFICATIONS, NOTIFICATION_GROUPS, type NotificationGroup } from '@/lib/v7r/data';
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { trackRoleSwitch, trackGigaChatAsked } from '@/lib/analytics/track';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборатория', bank: 'Банк', arbitrator: 'Арбитр', compliance: 'Комплаенс', executive: 'Руководитель',
};
const ROLE_STAGE: Record<PlatformRole, { label: string; tone: 'pilot' | 'demo' | 'field' }> = {
  operator: { label: 'Демо-данные', tone: 'pilot' }, buyer: { label: 'Демо-данные', tone: 'pilot' }, seller: { label: 'Демо-данные', tone: 'pilot' }, logistics: { label: 'Демо-данные', tone: 'pilot' }, bank: { label: 'Демо-данные', tone: 'demo' }, compliance: { label: 'Демо-данные', tone: 'demo' }, driver: { label: 'Полевой режим', tone: 'field' }, surveyor: { label: 'Полевой режим', tone: 'field' }, elevator: { label: 'Полевой режим', tone: 'field' }, lab: { label: 'Полевой режим', tone: 'field' }, arbitrator: { label: 'Демо-данные', tone: 'demo' }, executive: { label: 'Демо-данные', tone: 'demo' },
};
const ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower', buyer: '/platform-v7/buyer', seller: '/platform-v7/seller', logistics: '/platform-v7/logistics', driver: '/platform-v7/driver', surveyor: '/platform-v7/surveyor', elevator: '/platform-v7/elevator', lab: '/platform-v7/lab', bank: '/platform-v7/bank', arbitrator: '/platform-v7/arbitrator', compliance: '/platform-v7/compliance', executive: '/platform-v7/executive',
};
const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string }>> = {
  operator: [{ href: '/platform-v7/control-tower', label: 'Control Tower' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/lots', label: 'Лоты' }, { href: '/platform-v7/logistics', label: 'Логистика' }, { href: '/platform-v7/executive', label: 'Аналитика' }, { href: '/platform-v7/connectors', label: 'Интеграции' }, { href: '/platform-v7/bank', label: 'Банк' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  buyer: [{ href: '/platform-v7/buyer', label: 'Кабинет' }, { href: '/platform-v7/procurement', label: 'Закупки' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/bank', label: 'Деньги' }],
  seller: [{ href: '/platform-v7/seller', label: 'Кабинет' }, { href: '/platform-v7/lots', label: 'Лоты' }, { href: '/platform-v7/lots/create', label: 'Создать лот' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  logistics: [{ href: '/platform-v7/logistics', label: 'Диспетчерская' }, { href: '/platform-v7/driver', label: 'Водитель' }, { href: '/platform-v7/elevator', label: 'Приёмка' }, { href: '/platform-v7/lab', label: 'Лаборатория' }],
  driver: [{ href: '/platform-v7/driver', label: 'Маршрут' }, { href: '/platform-v7/deals/DL-9103', label: 'Сделка' }],
  surveyor: [{ href: '/platform-v7/surveyor', label: 'Назначения' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  elevator: [{ href: '/platform-v7/elevator', label: 'Приёмка' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  lab: [{ href: '/platform-v7/lab', label: 'Пробы' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  bank: [{ href: '/platform-v7/bank', label: 'Банковый контур' }, { href: '/platform-v7/bank/factoring', label: 'Факторинг' }, { href: '/platform-v7/bank/escrow', label: 'Эскроу' }, { href: '/platform-v7/deals', label: 'Сделки' }, { href: '/platform-v7/disputes', label: 'Удержания' }],
  arbitrator: [{ href: '/platform-v7/arbitrator', label: 'Разбор' }, { href: '/platform-v7/disputes', label: 'Споры' }],
  compliance: [{ href: '/platform-v7/compliance', label: 'Допуск' }, { href: '/platform-v7/connectors', label: 'Интеграции' }, { href: '/platform-v7/deals', label: 'Сделки' }],
  executive: [{ href: '/platform-v7/executive', label: 'Сводка' }, { href: '/platform-v7/control-tower', label: 'Control Tower' }, { href: '/platform-v7/bank', label: 'Деньги' }],
};
const CRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена', 'control-tower': 'Control Tower', deals: 'Сделки', lots: 'Лоты', create: 'Создание', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', field: 'Поле и приёмка', bank: 'Банк', disputes: 'Споры', compliance: 'Комплаенс', analytics: 'Сводка', executive: 'Сводка', procurement: 'Закупки', driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборатория', arbitrator: 'Арбитр', connectors: 'Интеграции', investor: 'Инвестор', demo: 'Демо'
};
function stageColors(tone: 'pilot' | 'demo' | 'field') {
  if (tone === 'pilot') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'demo') return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' };
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}
function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({ href: '/' + parts.slice(0, index + 1).join('/'), label: CRUMB_LABELS[part] ?? part, isLast: index === parts.length - 1 }));
}
function inferRoleFromPath(pathname: string, currentRole: PlatformRole): PlatformRole {
  if (pathname.startsWith('/platform-v7/control-tower')) return 'operator';
  if (pathname.startsWith('/platform-v7/buyer') || pathname.startsWith('/platform-v7/procurement')) return 'buyer';
  if (pathname.startsWith('/platform-v7/seller') || pathname.startsWith('/platform-v7/lots')) return 'seller';
  if (pathname.startsWith('/platform-v7/logistics')) return 'logistics';
  if (pathname.startsWith('/platform-v7/driver')) return 'driver';
  if (pathname.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (pathname.startsWith('/platform-v7/elevator')) return 'elevator';
  if (pathname.startsWith('/platform-v7/lab')) return 'lab';
  if (pathname.startsWith('/platform-v7/bank')) return 'bank';
  if (pathname.startsWith('/platform-v7/arbitrator')) return 'arbitrator';
  if (pathname.startsWith('/platform-v7/compliance')) return 'compliance';
  if (pathname.startsWith('/platform-v7/analytics') || pathname.startsWith('/platform-v7/executive')) return 'executive';
  return currentRole;
}
function gigaChatChips(pathname: string): string[] {
  const dealMatch = pathname.match(/\/deals\/([^/]+)/);
  if (dealMatch) {
    const id = dealMatch[1];
    return [`Почему сделка ${id} заблокирована?`,`Кто следующий владелец по ${id}?`,`Каких документов не хватает в ${id}?`,`Куда идти дальше по ${id}?`];
  }
  const lotMatch = pathname.match(/\/lots\/([^/]+)/);
  if (lotMatch && lotMatch[1] !== 'create') {
    const id = lotMatch[1];
    return [`Что за лот ${id}?`,`Статус документов по ${id}`,`Как перевести ${id} в PASS?`,`Куда идти дальше по ${id}?`];
  }
  if (pathname.startsWith('/platform-v7/disputes')) return ['Как открыть спор?','Какие документы нужны для арбитража?','Сколько длится рассмотрение спора?','Кто может закрыть спор?'];
  if (pathname.startsWith('/platform-v7/bank')) return ['Почему деньги стоят?','Когда разморозят счёт?','Какие условия аккредитива?','Что нужно для выплаты?'];
  if (pathname.startsWith('/platform-v7/lots')) return ['Как создать лот быстро?','Какие документы обязательны?','Почему лот в статусе REVIEW?','Как получить статус PASS?'];
  return ['Почему выпуск заблокирован','Кто держит следующий шаг','Каких документов нет','Куда идти дальше'];
}
function systemStatus(pathname: string) {
  const bankTone = pathname.startsWith('/platform-v7/bank') ? { label: 'Банк · проверка', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' } : { label: 'Банк · ок', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  return [{ label: 'ФГИС · ок', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' }, bankTone];
}
function groupNotifications() {
  return NOTIFICATIONS.reduce<Record<NotificationGroup, typeof NOTIFICATIONS>>((acc, item) => { (acc[item.group] ||= []).push(item); return acc; }, {} as Record<NotificationGroup, typeof NOTIFICATIONS>);
}

export function AppShellV3({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, clearRoleSelection } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const gSequenceRef = React.useRef(false);

  React.useEffect(() => { usePlatformV7RStore.persist.rehydrate(); setMounted(true); }, []);
  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pc-theme') : null;
    if (stored === 'dark') { setTheme('dark'); document.documentElement.setAttribute('data-theme', 'dark'); }
  }, []);
  React.useEffect(() => {
    if (!mounted) return;
    const inferred = inferRoleFromPath(pathname, role || initialRole);
    if (inferred !== role) setRole(inferred);
  }, [pathname, role, setRole, mounted, initialRole]);
  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pc-theme', next);
        if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
      }
      return next;
    });
  }, []);

  const displayRole: PlatformRole = mounted ? role : initialRole;
  const items = NAV_BY_ROLE[displayRole];
  const stage = ROLE_STAGE[displayRole];
  const stageTone = stageColors(stage.tone);
  const crumbs = breadcrumbs(pathname);
  const showCrumbs = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const statuses = systemStatus(pathname);
  const chips = gigaChatChips(pathname);
  const groupedNotifications = React.useMemo(() => groupNotifications(), []);
  const showBanner = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles';

  React.useEffect(() => { setSidebarOpen(false); setAlertsOpen(false); setPaletteOpen(false); }, [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (!isTyping && event.key === '/') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (isTyping) return;
      if (gSequenceRef.current) {
        gSequenceRef.current = false;
        if (event.key.toLowerCase() === 'd') { event.preventDefault(); router.push('/platform-v7/control-tower'); return; }
        if (event.key.toLowerCase() === 's') { event.preventDefault(); router.push('/platform-v7/deals'); return; }
        if (event.key.toLowerCase() === 'l') { event.preventDefault(); router.push('/platform-v7/lots'); return; }
      }
      if (event.key.toLowerCase() === 'g') {
        gSequenceRef.current = true;
        window.setTimeout(() => { gSequenceRef.current = false; }, 900);
        return;
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        router.push('/platform-v7/lots/create');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style>{`html,body{overflow-x:hidden;max-width:100%}*,*::before,*::after{box-sizing:border-box}.pc-shell-header{max-width:1360px;margin:0 auto;padding:10px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.pc-shell-header > *{min-width:0}.pc-header-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.pc-header-brand{display:flex;align-items:center;gap:12px;min-width:0;flex:1 1 auto}.pc-brand-copy{min-width:0;display:grid;gap:2px}.pc-brand-title{font-size:16px;font-weight:800;color:var(--pc-text-primary);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-brand-subtitle{font-size:11px;color:var(--pc-text-muted);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-brand-crumbs{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0}.pc-header-actions{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap}.pc-header-search{width:100%;min-width:0;max-width:none !important;display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:44px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-card);cursor:pointer}.pc-alert-panel{position:absolute;right:0;top:42px;width:340px;max-width:calc(100vw - 32px);background:var(--pc-bg-card);border:1px solid var(--pc-border);border-radius:14px;box-shadow:var(--pc-shadow);padding:10px;z-index:71;max-height:70vh;overflow-y:auto;overflow-x:hidden}.pc-role-banner{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:var(--pc-bg-card);border:1px solid var(--pc-border);margin-bottom:12px;font-size:12px;color:var(--pc-text-secondary);flex-wrap:wrap}.pc-giga{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:var(--pc-accent-bg);border:1px solid var(--pc-accent-border);margin-top:12px}.pc-giga-title{font-size:13px;font-weight:900;color:var(--pc-text-primary)}.pc-giga-text{font-size:12px;color:var(--pc-text-secondary);line-height:1.5;margin-top:4px}.pc-giga-chiprow{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pc-giga-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:var(--pc-bg-card);border:1px solid var(--pc-accent-border);color:var(--pc-accent);font-size:11px;font-weight:800;cursor:pointer}.pc-giga-chip:hover{background:var(--pc-accent-bg)}.pc-mobile-role{display:none}@media (max-width: 768px){.pc-shell-header{padding:10px 12px;gap:10px}.pc-header-top{align-items:flex-start}.pc-header-brand{gap:10px}.pc-brand-title{font-size:15px}.pc-brand-subtitle,.pc-brand-crumbs{display:none}.pc-alert-panel{position:fixed;left:12px;right:12px;top:72px;width:auto;max-width:none;max-height:min(70vh,calc(100dvh - 96px))}.pc-header-actions{gap:8px;flex-wrap:nowrap;justify-content:flex-end}.pc-header-actions .v9-desktop-only{display:none !important}.pc-header-actions select{display:none !important}.pc-mobile-role{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:132px;padding:8px 12px;border-radius:10px;border:1px solid var(--pc-border);background:var(--pc-bg-card);font-size:13px;font-weight:700;color:var(--pc-text-primary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-header-search{padding:10px 12px;border-radius:12px;min-height:44px}}@media (max-width: 560px){.pc-role-banner{align-items:flex-start}.pc-role-banner a{margin-left:0 !important}.pc-giga{grid-template-columns:1fr}.pc-header-actions{gap:6px}.pc-mobile-role{max-width:120px}}`}</style>
      {sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.36)', zIndex: 79 }} aria-hidden /> : null}
      {alertsOpen ? <div onClick={() => setAlertsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 69 }} aria-hidden /> : null}
      <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: 286, maxWidth: '84vw', zIndex: 80, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease', background: 'var(--pc-bg-card)', borderRight: '1px solid var(--pc-border)', boxShadow: sidebarOpen ? 'var(--pc-shadow)' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 18, borderBottom: '1px solid var(--pc-border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><div style={{ fontSize: 19, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Прозрачная Цена</div><div style={{ fontSize: 11, color: 'var(--pc-text-muted)', marginTop: 4 }}>Цифровой контур исполнения сделки</div></div><button onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню' style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pc-text-muted)', padding: 12, minWidth: 44, minHeight: 44, borderRadius: 10 }}><X size={18} aria-hidden /></button></div><div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)' }}><div style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>Текущий кабинет</div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, alignItems: 'center' }}><div suppressHydrationWarning style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{ROLE_LABELS[displayRole]}</div><span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: stageTone.bg, border: `1px solid ${stageTone.border}`, color: stageTone.color, fontSize: 10, fontWeight: 800 }}>{stage.label}</span></div></div></div>
        <nav style={{ padding: 12, display: 'grid', gap: 4, overflowY: 'auto' }}>{items.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + '/'); return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none', padding: '14px 12px', borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 600, background: active ? 'var(--pc-accent-bg)' : 'transparent', color: active ? 'var(--pc-accent)' : 'var(--pc-text-primary)', border: active ? '1px solid var(--pc-accent-border)' : '1px solid transparent' }}>{item.label}</Link>; })}</nav>
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--pc-border)', display: 'grid', gap: 8 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Link href='/platform-v7/investor' style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Инвестор</Link><Link href='/platform-v7/demo' style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Демо</Link></div><Link href='/platform-v7/roles' onClick={() => { clearRoleSelection(); setSidebarOpen(false); }} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>Все роли</Link></div>
      </aside>
      <div>
        <header style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--pc-bg-header)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--pc-border)' }}>
          <div className='pc-shell-header'>
            <div className='pc-header-top'>
              <div className='pc-header-brand'>
                <button onClick={() => setSidebarOpen(true)} aria-label='Открыть меню' style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 12, padding: 10, minWidth: 44, minHeight: 44, cursor: 'pointer', lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Menu size={18} aria-hidden /></button>
                <div className='pc-brand-copy'>
                  <div className='pc-brand-title'>Прозрачная Цена</div>
                  {showCrumbs ? (
                    <nav className='pc-brand-crumbs' aria-label='Хлебные крошки'>
                      {crumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.href}>
                          {index > 0 ? <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>/</span> : null}
                          {crumb.isLast ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary)' }}>{crumb.label}</span> : <Link href={crumb.href} style={{ textDecoration: 'none', color: 'var(--pc-text-muted)', fontSize: 12, fontWeight: 500 }}>{crumb.label}</Link>}
                        </React.Fragment>
                      ))}
                    </nav>
                  ) : (
                    <div className='pc-brand-subtitle'>Цифровой контур исполнения сделки</div>
                  )}
                </div>
              </div>

              <div className='pc-header-actions'>
                {statuses.map((item) => (<span key={item.label} className='v9-desktop-only' style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: item.bg, border: `1px solid ${item.border}`, color: item.color, fontSize: 11, fontWeight: 800 }}>{item.label}</span>))}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setAlertsOpen((v) => !v)} aria-label={`Уведомления: ${NOTIFICATIONS.length}`} aria-expanded={alertsOpen} style={{ position: 'relative', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 12, padding: 10, minWidth: 44, minHeight: 44, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}><Bell size={18} aria-hidden /><span style={{ position: 'absolute', top: -6, right: -4, minWidth: 18, height: 18, borderRadius: 999, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{NOTIFICATIONS.length}</span></button>
                  {alertsOpen ? (<div role='dialog' aria-label='Уведомления' className='pc-alert-panel'><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px', gap: 10 }}><span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Уведомления</span><span style={{ fontSize: 11, color: 'var(--pc-text-muted)', whiteSpace: 'nowrap' }}>{NOTIFICATIONS.length} активных</span></div>{Object.entries(groupedNotifications).map(([group, items]) => (<div key={group} style={{ display: 'grid', gap: 4, marginBottom: 8 }}><div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 800, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{NOTIFICATION_GROUPS[group as NotificationGroup]} · {items.length}</div>{items.map((item) => (<Link key={item.id} href={item.href} onClick={() => setAlertsOpen(false)} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 10, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>{item.text}</Link>))}</div>))}</div>) : null}
                </div>
                <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 12, padding: 10, minWidth: 44, minHeight: 44, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0, color: 'var(--pc-text-secondary)' }}>{theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}</button>
                <button suppressHydrationWarning className='pc-mobile-role' type='button' onClick={() => setSidebarOpen(true)} aria-label={`Текущая роль: ${ROLE_LABELS[displayRole]}. Открыть меню роли`}>{ROLE_LABELS[displayRole]}</button>
                <select suppressHydrationWarning value={displayRole} onChange={(event) => { const nextRole = event.target.value as PlatformRole; setRole(nextRole); trackRoleSwitch(nextRole); router.push(ROLE_ROUTES[nextRole]); }} style={{ minWidth: 150, border: '1px solid var(--pc-border)', borderRadius: 12, padding: '10px 12px', minHeight: 44, fontSize: 13, background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontWeight: 600 }}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <button className='pc-header-search' onClick={() => setPaletteOpen(true)} aria-label='Открыть быстрый поиск (Cmd+K)'>
              <Search size={16} aria-hidden style={{ color: 'var(--pc-text-muted)', flexShrink: 0 }} />
              <span style={{ color: 'var(--pc-text-muted)', fontSize: 13, textAlign: 'left', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Поиск по сделкам, лотам и спорам</span>
              <span className='v9-desktop-only' style={{ color: 'var(--pc-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>⌘ K</span>
            </button>
          </div>
        </header>
        <main style={{ padding: 16, maxWidth: 1360, margin: '0 auto', overflowX: 'hidden' }}>{showBanner ? (<div role='status' aria-live='polite' className='pc-role-banner'><span suppressHydrationWarning style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, background: stageTone.bg, border: `1px solid ${stageTone.border}`, color: stageTone.color, fontSize: 10, fontWeight: 800 }}>{stage.label}</span><span suppressHydrationWarning style={{ minWidth: 0, wordBreak: 'break-word' }}>Вы на роли <strong style={{ color: '#0F1419' }}>{ROLE_LABELS[displayRole]}</strong>. Переключитесь в меню, если нужен другой рабочий контекст.</span><Link suppressHydrationWarning href={ROLE_ROUTES[displayRole]} style={{ marginLeft: 'auto', textDecoration: 'none', color: '#0A7A5F', fontWeight: 700, fontSize: 12 }}>Главная роли →</Link></div>) : null}{children}{showBanner ? (<section className='pc-giga'><div><div className='pc-giga-title'>GigaChat · быстрые вопросы по сделке</div><div className='pc-giga-text'>Решает: где спор, кто следующий владелец, почему деньги стоят, каких документов не хватает и куда идти дальше.</div><div className='pc-giga-chiprow'>{chips.map((chip) => (<span key={chip} className='pc-giga-chip' onClick={() => { trackGigaChatAsked(pathname); setPaletteOpen(true); }}>{chip}</span>))}</div></div><button onClick={() => { trackGigaChatAsked(pathname); setPaletteOpen(true); }} style={{ borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Спросить</button></section>) : null}</main></div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
