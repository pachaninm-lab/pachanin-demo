'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { selectRuntimeDeals, selectRuntimeDisputes } from '@/lib/domain/selectors';
import { platformV7CommandSectionItems } from '@/lib/platform-v7/command';
import { lots as PLATFORM_LOTS } from '@/lib/v7r/esia-fgis-data';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

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

const ROLE_OWNED_PREFIXES: Array<{ prefix: string; role: PlatformRole }> = [
  { prefix: '/platform-v7/control-tower', role: 'operator' },
  { prefix: '/platform-v7/operator', role: 'operator' },
  { prefix: '/platform-v7/buyer', role: 'buyer' },
  { prefix: '/platform-v7/procurement', role: 'buyer' },
  { prefix: '/platform-v7/seller', role: 'seller' },
  { prefix: '/platform-v7/lots', role: 'seller' },
  { prefix: '/platform-v7/logistics', role: 'logistics' },
  { prefix: '/platform-v7/driver', role: 'driver' },
  { prefix: '/platform-v7/surveyor', role: 'surveyor' },
  { prefix: '/platform-v7/elevator', role: 'elevator' },
  { prefix: '/platform-v7/lab', role: 'lab' },
  { prefix: '/platform-v7/bank', role: 'bank' },
  { prefix: '/platform-v7/arbitrator', role: 'arbitrator' },
  { prefix: '/platform-v7/disputes', role: 'arbitrator' },
  { prefix: '/platform-v7/compliance', role: 'compliance' },
  { prefix: '/platform-v7/connectors', role: 'compliance' },
  { prefix: '/platform-v7/executive', role: 'executive' },
  { prefix: '/platform-v7/analytics', role: 'executive' },
];

function roleOwnerForHref(href: string): PlatformRole | null {
  const match = ROLE_OWNED_PREFIXES.find((item) => href === item.prefix || href.startsWith(item.prefix + '/'));
  return match?.role ?? null;
}

function isSharedHrefForRole(href: string, role: PlatformRole): boolean {
  if (role === 'operator' && ['/platform-v7/bank', '/platform-v7/disputes', '/platform-v7/logistics', '/platform-v7/lots'].some((prefix) => href === prefix || href.startsWith(prefix + '/'))) return true;
  if (role === 'executive' && ['/platform-v7/bank', '/platform-v7/control-tower'].some((prefix) => href === prefix || href.startsWith(prefix + '/'))) return true;
  if (role === 'surveyor' && (href === '/platform-v7/disputes' || href.startsWith('/platform-v7/disputes/'))) return true;
  if (role === 'bank' && (href === '/platform-v7/disputes' || href.startsWith('/platform-v7/disputes/'))) return true;
  if (role === 'buyer' && (href === '/platform-v7/lots' || href.startsWith('/platform-v7/lots/'))) return true;
  return false;
}

function isAllowedForRole(item: CommandItem, role: PlatformRole): boolean {
  if (item.href === '/platform-v7/roles') return false;
  if (isSharedHrefForRole(item.href, role)) return true;
  const owner = roleOwnerForHref(item.href);
  return !owner || owner === role;
}

function buildIndex(role: PlatformRole): CommandItem[] {
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
    subtitle: `Сделка ${dispute.dealId} · ответственный ${dispute.ballAt} · срок реакции ${dispute.slaDaysLeft} дн.`,
    href: `/platform-v7/disputes/${dispute.id}`,
    keywords: `${dispute.id} ${dispute.title} ${dispute.dealId} ${dispute.reasonCode}`.toLowerCase(),
  }));

  return [...platformV7CommandSectionItems(), ...dealItems, ...lotItems, ...disputeItems].filter((item) => isAllowedForRole(item, role));
}

function readRecentItems(role: PlatformRole): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${HISTORY_KEY}-${role}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecentItem(item: CommandItem, role: PlatformRole) {
  if (typeof window === 'undefined') return;
  const current = readRecentItems(role).filter((entry) => entry.href !== item.href);
  const next: RecentItem[] = [{ id: item.id, href: item.href, title: item.title, subtitle: item.subtitle }, ...current].slice(0, 6);
  window.localStorage.setItem(`${HISTORY_KEY}-${role}`, JSON.stringify(next));
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role) ?? 'operator';
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recentItems, setRecentItems] = React.useState<RecentItem[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const index = React.useMemo(() => buildIndex(role), [role]);
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
    writeRecentItem(item, role);
    setRecentItems(readRecentItems(role));
    router.push(item.href);
    onClose();
  }, [onClose, role, router]);

  React.useEffect(() => {
    if (!open) return;
    setRecentItems(readRecentItems(role));
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, role]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((value) => Math.min(value + 1, Math.max(filtered.length - 1, 0)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((value) => Math.max(value - 1, 0));
      }
      if (event.key === 'Enter' && filtered[activeIndex]) {
        event.preventDefault();
        selectItem(filtered[activeIndex]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, filtered, onClose, open, selectItem]);

  if (!open) return null;

  return (
    <div role='dialog' aria-modal='true' aria-label='Поиск по платформе' style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(3,8,7,0.48)', display: 'grid', placeItems: 'start center', padding: 'calc(env(safe-area-inset-top) + 72px) 14px 24px' }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '78vh', overflow: 'hidden', borderRadius: 26, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', boxShadow: 'var(--pc-shadow-lg)', display: 'grid' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 40px', gap: 10, alignItems: 'center', padding: 14, borderBottom: '1px solid var(--pc-border)' }}>
          <Search size={19} color='var(--pc-text-muted)' />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Сделка, лот, спор, документ, раздел...' style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: 'var(--pc-text-primary)', fontSize: 15, fontWeight: 800 }} />
          <button onClick={onClose} aria-label='Закрыть поиск' style={{ width: 38, height: 38, borderRadius: 13, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)', color: 'var(--pc-text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: 12, display: 'grid', gap: 10 }}>
          {!query.trim() && recentItems.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={groupTitle}>Недавние</div>
              {recentItems.map((item) => (
                <button key={item.href} onClick={() => { router.push(item.href); onClose(); }} style={itemButton(false)}>
                  <span style={itemTitle}>{item.title}</span>
                  <span style={itemSubtitle}>{item.subtitle}</span>
                </button>
              ))}
            </div>
          ) : null}

          {Object.entries(groups).map(([group, items]) => (
            <div key={group} style={{ display: 'grid', gap: 6 }}>
              <div style={groupTitle}>{group}</div>
              {items.map((item) => {
                const flatIndex = filtered.findIndex((candidate) => candidate.id === item.id);
                const active = flatIndex === activeIndex;
                return (
                  <button key={item.id} onMouseEnter={() => setActiveIndex(flatIndex)} onClick={() => selectItem(item)} style={itemButton(active)}>
                    <span style={itemTitle}>{item.title}</span>
                    <span style={itemSubtitle}>{item.subtitle}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 ? <div style={{ padding: 18, color: 'var(--pc-text-muted)', fontSize: 13 }}>Ничего не найдено в контуре текущей роли.</div> : null}
        </div>
      </div>
    </div>
  );
}

const groupTitle: React.CSSProperties = {
  color: 'var(--pc-text-muted)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '4px 6px',
};

function itemButton(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    border: `1px solid ${active ? 'var(--pc-accent-border)' : 'var(--pc-border)'}`,
    background: active ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)',
    borderRadius: 16,
    padding: '10px 12px',
    display: 'grid',
    gap: 3,
    cursor: 'pointer',
  };
}

const itemTitle: React.CSSProperties = {
  color: 'var(--pc-text-primary)',
  fontSize: 13,
  fontWeight: 900,
};

const itemSubtitle: React.CSSProperties = {
  color: 'var(--pc-text-muted)',
  fontSize: 12,
  lineHeight: 1.4,
};
