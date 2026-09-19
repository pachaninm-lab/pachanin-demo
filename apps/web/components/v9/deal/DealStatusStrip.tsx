'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Landmark, AlertTriangle, type LucideIcon } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { ErrorBoundary } from '@/components/error-boundary';

type Tone = 'ok' | 'review' | 'risk';

interface StatusItem {
  key: string;
  label: string;
  detail: string;
  tone: Tone;
  icon: LucideIcon;
}

function statusPalette(tone: Tone): { bg: string; border: string; color: string } {
  if (tone === 'review') return { bg: 'rgba(245,180,30,0.10)', border: 'rgba(245,180,30,0.22)', color: '#F5B41E' };
  if (tone === 'ok') return { bg: 'rgba(126,242,196,0.10)', border: 'rgba(126,242,196,0.22)', color: 'var(--pc-accent)' };
  return { bg: 'rgba(255,139,144,0.10)', border: 'rgba(255,139,144,0.22)', color: '#FF8B90' };
}

function buildStatusItems(pathname: string): StatusItem[] {
  const isConnectorsRoute = pathname.startsWith('/platform-v7/connectors');
  const isBankRoute = pathname.startsWith('/platform-v7/bank');
  const isDisputesRoute = pathname.startsWith('/platform-v7/disputes');

  return [
    {
      key: 'fgis',
      label: 'ФГИС',
      detail: isConnectorsRoute ? 'требует сверки' : 'ждёт сверки',
      tone: 'review',
      icon: ShieldCheck,
    },
    {
      key: 'bank',
      label: 'Банк',
      detail: isBankRoute ? 'ручная проверка' : 'ждёт подтверждения',
      tone: 'review',
      icon: Landmark,
    },
    {
      key: 'disputes',
      label: 'Споры',
      detail: isDisputesRoute ? 'в работе' : 'критичных нет в сценарии',
      tone: isDisputesRoute ? 'risk' : 'ok',
      icon: AlertTriangle,
    },
  ];
}

const HIDDEN_ROLES = new Set<PlatformRole>(['driver', 'elevator', 'lab', 'surveyor']);

function filterByRole(items: StatusItem[], role: PlatformRole): StatusItem[] {
  if (HIDDEN_ROLES.has(role)) return [];
  if (role === 'bank') return items.filter((item) => item.key === 'bank');
  if (role === 'compliance') return items.filter((item) => item.key === 'fgis');
  if (role === 'arbitrator') return items.filter((item) => item.key === 'disputes');
  return items;
}

interface DealStatusStripInnerProps {
  pathname?: string;
}

function DealStatusStripInner({ pathname: pathnameProp }: DealStatusStripInnerProps) {
  const pathnameFromHook = usePathname();
  const pathname = pathnameProp ?? pathnameFromHook;
  const role = usePlatformV7RStore((state) => state.role);

  const allItems = buildStatusItems(pathname);
  const items = filterByRole(allItems, role);

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => {
        const Icon = item.icon;
        const palette = statusPalette(item.tone);
        return (
          <span
            key={item.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${palette.border}`,
              background: palette.bg,
              color: palette.color,
              fontSize: 11,
              fontWeight: 850,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={13} aria-hidden />
            {item.label}: {item.detail}
          </span>
        );
      })}
    </div>
  );
}

export function DealStatusStrip({ pathname }: DealStatusStripInnerProps) {
  return (
    <ErrorBoundary context="DealStatusStrip">
      <DealStatusStripInner pathname={pathname} />
    </ErrorBoundary>
  );
}
