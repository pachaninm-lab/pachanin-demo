'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DEALS, DISPUTES } from '@/lib/v7r/data';
import { lots as PLATFORM_LOTS } from '@/lib/v7r/esia-fgis-data';

interface CommandItem {
  id: string;
  group: 'Сделки' | 'Лоты' | 'Споры' | 'Разделы';
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

interface RecentItem {
  id: string;
  title: string;
  href: string;
  subtitle: string;
}

const HISTORY_KEY = 'pc-command-history';

const SECTION_ITEMS: CommandItem[] = [
  { id: 'sec-control', group: 'Разделы', title: 'Control Tower', subtitle: 'Дашборд оператора · KPI и приоритеты', href: '/platform-v7/control-tower', keywords: 'control tower оператор kpi' },
  { id: 'sec-deals', group: 'Разделы', title: 'Все сделки', subtitle: 'Реестр сделок с фильтрами по статусу и риску', href: '/platform-v7/deals', keywords: 'сделки deals реестр' },
  { id: 'sec-marketplace', group: 'Разделы', title: 'Витрина лотов', subtitle: '15+ лотов по культуре и региону', href: '/platform-v7/lots', keywords: 'витрина лоты marketplace маркетплейс' },
  { id: 'sec-bank', group: 'Разделы', title: 'Банковый контур', subtitle: 'Резервы, hold, callbacks, release', href: '/platform-v7/bank', keywords: 'банк bank деньги резерв release' },
  { id: 'sec-disputes', group: 'Разделы', title: 'Споры', subtitle: 'Открытые споры и удержания', href: '/platform-v7/disputes', keywords: 'споры disputes удержания hold' },
  { id: 'sec-logistics', group: 'Разделы', title: 'Логистика', subtitle: 'Маршруты, ETA, отклонения', href: '/platform-v7/logistics', keywords: 'логистика маршруты gps eta' },
  { id: 'sec-integrations', group: 'Разделы', title: 'Интеграции', subtitle: 'ФГИС, СберБизнес, СПАРК, лаборатории', href: '/platform-v7/connectors', keywords: 'интеграции connectors fgis sber spark' },
  { id: 'sec-operator', group: 'Разделы', title: 'Кабинет оператора', subtitle: 'Очереди, callbacks, ручные действия', href: '/platform-v7/operator', keywords: 'оператор operator queues очереди' },
  { id: 'sec-investor', group: 'Разделы', title: 'Инвестор', subtitle: 'Презентационный режим, портфель сделок', href: '/platform-v7/investor', keywords: 'инвестор investor портфель' },
  { id: 'sec-roles', group: 'Разделы', title: 'Все роли', subtitle: 'Сменить активную роль', href: '/platform-v7/roles', keywords: 'роли roles смена кабинет' },
];

function buildIndex(): CommandItem[] {
  const dealItems: CommandItem[] = DEALS.map((deal) => ({
    id: `deal-${deal.id}`,
    group: 'Сделки' as const,
    title: `${deal.id} · ${deal.grain}`,
    subtitle: `${deal.quantity} ${deal.unit} · ${deal.seller.name} → ${deal.buyer.name}`,
    href: `/platform-v7/deals/${deal.id}`,
    keywords: `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name} ${deal.lotId ?? ''} ${deal.routeId ?? ''}`.toLowerCase(),
  }));
  const lotItems: CommandItem[] = PLATFORM_LOTS.map((lot) => ({
    id: `lot-${lot.id}`,
    group: 'Лоты' as const,
    title: `${lot.id} · ${lot.title}`,
    subtitle: `${lot.grain} · ${lot.volumeTons} т · ${lot.sourceType}`,
    href: `/platform-v7/lots/${lot.id}`,
    keywords: `${lot.id} ${lot.title} ${lot.grain} ${lot.sourceType}`.toLowerCase(),
  }));
  const disputeItems: CommandItem[] = DISPUTES.map((d) => ({
    id: `dispute-${d.id}`,
    group: 'Споры' as const,
    title: `${d.id} · ${d.title}`,
    subtitle: `Сделка ${d.dealId} · ballAt ${d.ballAt} · SLA ${d.slaDaysLeft} дн.`,
    href: `/platform-v7/disputes/${d.id}`,
    keywords: `${d.id} ${d.title} ${d.dealId} ${d.reasonCode}`.toLowerCase(),
  }));
  return [...SECTION_ITEMS, ...dealItems, ...lotItems, ...disputeItems];
}

function readRecentItems(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecentItem(item: CommandItem) {
  if (typeof window === 'undefined') return;
  const current = readRecentItems().filter((entry) => entry.href !== item.href);
  const next: RecentItem[] = [{ id: item.id, href: item.href, title: item.title, subtitle: item.subtitle }, ...current].slice(0, 6);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recentItems, setRecentItems] = React.useState<RecentItem[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const index = React.useMemo(() => buildIndex(), []);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 24);
    return index
      .filter((item) => item.keywords.includes(q) || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
      .slice(0, 24);
  }, [index, query]);

  const groups = React.useMemo(() => filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {}), [filtered]);

  const selectItem = React.useCallback((item: CommandItem) => {
    writeRecentItem(item);
    setRecentItems(readRecentItems());
    router.push(item.href);
    onClose();
  }, [onClose, router]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setRecentItems(readRecentItems());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = filtered[activeIndex];
        if (target) selectItem(target);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex, onClose, selectItem]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Поиск по платформе" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,20,25,0.42)', display: 'grid', placeItems: 'start center', padding: '12vh 16px 16px' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} aria-hidden />
      <div style={{ position: 'relative', width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, boxShadow: '0 24px 60px rgba(9,30,66,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #E4E6EA' }}>
          <span aria-hidden style={{ color: '#6B778C', fontSize: 13 }}>⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: DL-9102, LOT-2403, спор, банк, водитель…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#0F1419', background: 'transparent' }}
          />
          <button onClick={onClose} aria-label="Закрыть" style={{ background: '#F5F7F8', border: '1px solid #E4E6EA', borderRadius: 8, padding: '4px 8px', fontSize: 11, color: '#6B778C', cursor: 'pointer' }}>esc</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 8 }}>
          {!query.trim() && recentItems.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Недавние переходы</div>
              {recentItems.map((item) => (
                <button key={item.id} onClick={() => { router.push(item.href); onClose(); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA', cursor: 'pointer', display: 'grid', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.subtitle}</div>
                </button>
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#6B778C', fontSize: 13 }}>
              Ничего не найдено. Попробуйте ID сделки (DL-9102), номер лота (LOT-2403) или название раздела.
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</div>
                {items.map((item) => {
                  const flatIndex = filtered.indexOf(item);
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => selectItem(item)}
                      style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: isActive ? 'rgba(10,122,95,0.08)' : 'transparent', border: isActive ? '1px solid rgba(10,122,95,0.16)' : '1px solid transparent', cursor: 'pointer', display: 'grid', gap: 2 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: '#6B778C' }}>{item.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, color: '#6B778C', background: '#F8FAFB' }}>
          <span>↑ ↓ навигация · Enter открыть · Esc закрыть</span>
          <span>{filtered.length} результатов</span>
        </div>
      </div>
    </div>
  );
}
