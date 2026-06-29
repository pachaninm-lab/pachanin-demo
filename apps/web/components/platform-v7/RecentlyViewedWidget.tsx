'use client';

import { useEffect, useState } from 'react';
import { getRecentItems, clearRecentItems, type RecentItem, type RecentItemType } from '@/lib/platform-v7/recently-viewed';

const TYPE_LABEL: Record<RecentItemType, string> = {
  deal:     'Сделка',
  lot:      'Лот',
  dispute:  'Спор',
  document: 'Документ',
};

const TYPE_COLOR: Record<RecentItemType, string> = {
  deal:     'var(--p7-color-brand)',
  lot:      'var(--p7-color-accent)',
  dispute:  'var(--status-dispute-text)',
  document: 'var(--p7-color-document)',
};

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

export function RecentlyViewedWidget() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(getRecentItems());
    const handler = () => setItems(getRecentItems());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span className="caption">Последние просмотренные</span>
        <button
          onClick={() => { clearRecentItems(); setItems([]); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', padding: '0.125rem 0.25rem',
          }}
          aria-label="Очистить историю просмотров"
        >
          Очистить
        </button>
      </div>

      {items.map((item) => (
        <a
          key={`${item.type}-${item.id}`}
          href={item.href}
          className="hover-row"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 0.75rem', borderRadius: '6px',
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 600,
            color: TYPE_COLOR[item.type], minWidth: '3rem',
          }}>
            {TYPE_LABEL[item.type]}
          </span>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--pc-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          {item.status && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', flexShrink: 0 }}>
              {item.status}
            </span>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', flexShrink: 0 }}>
            {formatRelative(item.viewedAt)}
          </span>
        </a>
      ))}
    </div>
  );
}
