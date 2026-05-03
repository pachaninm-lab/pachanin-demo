'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { selectRuntimeDeals, selectRuntimeDisputes } from '@/lib/domain/selectors';
import { platformV7CommandSectionItems } from '@/lib/platform-v7/command';
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

function buildIndex(): CommandItem[] {
  const dealItems: CommandItem[] = selectRuntimeDeals().map((deal) => ({
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

  const disputeItems: CommandItem[] = selectRuntimeDisputes().map((dispute) => ({
    id: `dispute-${dispute.id}`,
    group: 'Споры' as const,
    title: `${dispute.id} · ${dispute.title}`,
    subtitle: `Сделка ${dispute.dealId} · ответственный ${dispute.ballAt} · SLA ${dispute.slaDaysLeft} дн.`,
    href: `/platform-v7/disputes/${dispute.id}`,
    keywords: `${dispute.id} ${dispute.title} ${dispute.dealId} ${dispute.reasonCode}`.toLowerCase(),
  }));

  return [...platformV7CommandSectionItems(), ...dealItems, ...lotItems, ...disputeItems];
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
    if (!q) return index.slice(0, 18);
    return index.filter((item) => item.keywords.includes(q) || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)).slice(0, 18);
  }, [index, query]);

  const groups = React.useMemo(
    () => filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
      (acc[item.group] ||= []).push(item);
      return acc;
    }, {}),
    [filtered],
  );

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

  React.useEffect(() => setActiveIndex(0), [query]);

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
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((value) => Math.max(value - 1, 0));
        return;
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
      aria-label='Быстрый переход по платформе'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15, 20, 25, 0.42)',
        display: 'grid',
        placeItems: 'start center',
        padding: 'max(84px, calc(env(safe-area-inset-top) + 72px)) 16px 16px',
      }}
    >
      <button onClick={onClose} aria-label='Закрыть поиск' style={{ position: 'absolute', inset: 0, border: 0, background: 'transparent', cursor: 'default' }} />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 680,
          background: 'var(--pc-bg-card)',
          border: '1px solid var(--pc-border)',
          borderRadius: 22,
          boxShadow: '0 28px 80px rgba(15,20,25,0.24)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(72vh, 720px)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderBottom: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)' }}>
          <span aria-hidden style={{ width: 42, height: 42, borderRadius: 14, border: '1px solid var(--pc-accent-border)', background: 'var(--pc-accent-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pc-accent)', flexShrink: 0 }}>
            <Search size={18} strokeWidth={2.2} />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Найти сделку, лот, спор или раздел'
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 42,
              border: '1px solid var(--pc-border)',
              outline: 'none',
              borderRadius: 12,
              padding: '0 12px',
              fontSize: 16,
              fontWeight: 750,
              color: 'var(--pc-text-primary)',
              background: 'var(--pc-bg-elevated)',
            }}
          />

          <button onClick={onClose} aria-label='Закрыть' style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 0, color: 'var(--pc-text-secondary)', cursor: 'pointer', minHeight: 42, minWidth: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 12, display: 'grid', gap: 10 }}>
          {!query.trim() && recentItems.length > 0 ? (
            <ResultGroup title='Недавние переходы'>
              {recentItems.map((item) => (
                <ResultButton key={item.id} title={item.title} subtitle={item.subtitle} onClick={() => { router.push(item.href); onClose(); }} />
              ))}
            </ResultGroup>
          ) : null}

          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--pc-text-muted)', fontSize: 13 }}>Ничего не найдено. Введите номер сделки, лота, спора или название раздела.</div>
          ) : Object.entries(groups).map(([group, items]) => (
            <ResultGroup key={group} title={group}>
              {items.map((item) => {
                const flatIndex = filtered.indexOf(item);
                const isActive = flatIndex === activeIndex;
                return (
                  <ResultButton key={item.id} title={item.title} subtitle={item.subtitle} active={isActive} onMouseEnter={() => setActiveIndex(flatIndex)} onClick={() => selectItem(item)} />
                );
              })}
            </ResultGroup>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--pc-border)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--pc-text-muted)', background: 'var(--pc-bg-card)', flexWrap: 'wrap' }}>
          <span>↑ ↓ навигация · Enter открыть</span>
          <span>{filtered.length} результатов</span>
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ padding: '2px 4px', fontSize: 11, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {children}
    </div>
  );
}

function ResultButton({ title, subtitle, active = false, onMouseEnter, onClick }: { title: string; subtitle: string; active?: boolean; onMouseEnter?: () => void; onClick: () => void }) {
  return (
    <button
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '13px 14px',
        borderRadius: 16,
        background: active ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)',
        border: active ? '1px solid var(--pc-accent-border)' : '1px solid var(--pc-border)',
        cursor: 'pointer',
        display: 'grid',
        gap: 4,
        boxShadow: 'var(--pc-shadow-sm)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)' }}>{subtitle}</div>
    </button>
  );
}
