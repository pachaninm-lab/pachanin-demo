'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowUpDown, CornerDownLeft, X } from 'lucide-react';
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

  const disputeItems: CommandItem[] = DISPUTES.map((dispute) => ({
    id: `dispute-${dispute.id}`,
    group: 'Споры' as const,
    title: `${dispute.id} · ${dispute.title}`,
    subtitle: `Сделка ${dispute.dealId} · ballAt ${dispute.ballAt} · SLA ${dispute.slaDaysLeft} дн.`,
    href: `/platform-v7/disputes/${dispute.id}`,
    keywords: `${dispute.id} ${dispute.title} ${dispute.dealId} ${dispute.reasonCode}`.toLowerCase(),
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
  const next: RecentItem[] = [
    { id: item.id, href: item.href, title: item.title, subtitle: item.subtitle },
    ...current,
  ].slice(0, 6);
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
      .filter(
        (item) =>
          item.keywords.includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [index, query]);

  const groups = React.useMemo(
    () =>
      filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
        (acc[item.group] ||= []).push(item);
        return acc;
      }, {}),
    [filtered],
  );

  const selectItem = React.useCallback(
    (item: CommandItem) => {
      writeRecentItem(item);
      setRecentItems(readRecentItems());
      router.push(item.href);
      onClose();
    },
    [onClose, router],
  );

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
        setActiveIndex((value) => Math.min(value + 1, filtered.length - 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((value) => Math.max(value - 1, 0));
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
    <div
      role='dialog'
      aria-modal='true'
      aria-label='Поиск по платформе'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(3, 8, 7, 0.72)',
        display: 'grid',
        placeItems: 'start center',
        padding: '12vh 16px 16px',
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} aria-hidden />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 680,
          background: 'linear-gradient(180deg, rgba(17,28,25,0.98) 0%, rgba(10,18,16,0.99) 100%)',
          border: '1px solid var(--pc-border)',
          borderRadius: 20,
          boxShadow: 'var(--pc-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '72vh',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--pc-border)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: '1px solid var(--pc-accent-border)',
              background: 'var(--pc-accent-bg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pc-accent)',
              flexShrink: 0,
            }}
          >
            <Search size={16} strokeWidth={2.1} />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Поиск: DL-9102, LOT-2403, спор, банк, водитель…'
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: 'var(--pc-text-primary)',
              background: 'transparent',
            }}
          />

          <button
            onClick={onClose}
            aria-label='Закрыть'
            style={{
              background: 'var(--pc-bg-elevated)',
              border: '1px solid var(--pc-border)',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: 11,
              color: 'var(--pc-text-muted)',
              cursor: 'pointer',
              minHeight: 40,
              minWidth: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} strokeWidth={2.1} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 10 }}>
          {!query.trim() && recentItems.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--pc-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Недавние переходы
              </div>

              {recentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '12px 13px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--pc-border)',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 3,
                    boxShadow: 'var(--pc-shadow-sm)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)' }}>{item.subtitle}</div>
                </button>
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--pc-text-muted)', fontSize: 13 }}>
              Ничего не найдено. Попробуй ID сделки, номер лота или название раздела.
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--pc-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {group}
                </div>

                {items.map((item) => {
                  const flatIndex = filtered.indexOf(item);
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => selectItem(item)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 13px',
                        borderRadius: 14,
                        background: isActive ? 'var(--pc-accent-bg)' : 'rgba(255,255,255,0.02)',
                        border: isActive ? '1px solid var(--pc-accent-border)' : '1px solid var(--pc-border)',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 3,
                        boxShadow: 'var(--pc-shadow-sm)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)' }}>{item.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--pc-border)',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: 'var(--pc-text-muted)',
            background: 'rgba(255,255,255,0.02)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpDown size={14} strokeWidth={2.1} />
              ↑ ↓ навигация
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CornerDownLeft size={14} strokeWidth={2.1} />
              Enter открыть
            </span>
          </span>
          <span>{filtered.length} результатов</span>
        </div>
      </div>
    </div>
  );
}
