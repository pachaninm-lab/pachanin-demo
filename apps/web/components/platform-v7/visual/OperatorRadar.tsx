'use client';

import * as React from 'react';
import { Banknote, FileText, Truck, Gavel, AlertTriangle } from 'lucide-react';
import { DealStatusEdge } from './DealStatusEdge';
import type { DealStatusEdgeStatus } from './DealStatusEdge';

/**
 * OperatorRadar — для оператора вместо хаоса карточек.
 *
 * В каждой зоне только 1–3 критичных объекта.
 * Зоны: Деньги · Документы · Рейсы · Споры · Риски
 *
 * Компонент presentational, данные через props.
 */

export interface RadarItem {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly money?: string;
  readonly status: DealStatusEdgeStatus;
  readonly href?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export interface RadarZone {
  readonly id: 'money' | 'documents' | 'trips' | 'disputes' | 'risks';
  readonly label: string;
  readonly items: RadarItem[];
  readonly allClearMessage?: string;
}

export interface OperatorRadarProps {
  readonly zones: RadarZone[];
  readonly mode?: 'operator' | 'executive';
  readonly 'data-testid'?: string;
}

const ZONE_ICONS = {
  money:     Banknote,
  documents: FileText,
  trips:     Truck,
  disputes:  Gavel,
  risks:     AlertTriangle,
};

const ZONE_LABELS: Record<RadarZone['id'], string> = {
  money:     'Деньги',
  documents: 'Документы',
  trips:     'Рейсы',
  disputes:  'Споры',
  risks:     'Риски',
};

const STATUS_BORDER_COLOR: Record<DealStatusEdgeStatus, string> = {
  moving:  'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
  waiting: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
  blocked: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',
  money:   'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
  idle:    'var(--p7-color-border, #D7DEE3)',
};

function RadarCard({ item }: { item: RadarItem }) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '10px 12px 10px 16px',
        borderRadius: 12,
        border: `1px solid ${STATUS_BORDER_COLOR[item.status]}`,
        background: 'var(--p7-color-surface, #FFFFFF)',
        display: 'grid',
        gap: 4,
      }}
    >
      <DealStatusEdge status={item.status} position='left' thickness={3} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 850, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.35, flex: 1, minWidth: 0 }}>
          {item.title}
        </span>
        {item.money && (
          <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--p7-color-money, #155EEF)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {item.money}
          </span>
        )}
      </div>

      {item.detail && (
        <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', lineHeight: 1.35 }}>
          {item.detail}
        </span>
      )}

      {item.actionLabel && item.onAction && (
        <button
          type='button'
          onClick={item.onAction}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            padding: '3px 9px',
            borderRadius: 7,
            border: '1px solid var(--p7-color-brand, #0A7A5F)',
            background: 'transparent',
            color: 'var(--p7-color-brand, #0A7A5F)',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {item.actionLabel}
        </button>
      )}
    </div>
  );
}

function RadarZoneColumn({ zone, executive }: { zone: RadarZone; executive: boolean }) {
  const Icon = ZONE_ICONS[zone.id];
  const hasBlockers = zone.items.some((i) => i.status === 'blocked' || i.status === 'waiting');
  const topItems = zone.items.slice(0, 3);

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        alignContent: 'flex-start',
      }}
    >
      {/* Zone header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon
          size={14}
          strokeWidth={2}
          style={{ color: hasBlockers ? 'var(--p7-color-danger, #B42318)' : 'var(--p7-color-text-muted, #667085)', flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {ZONE_LABELS[zone.id]}
        </span>
        {zone.items.length > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              borderRadius: 999,
              background: hasBlockers
                ? 'color-mix(in srgb, var(--p7-color-danger, #B42318) 12%, transparent)'
                : 'var(--p7-color-surface-muted, #F2F6F0)',
              color: hasBlockers ? 'var(--p7-color-danger, #B42318)' : 'var(--p7-color-text-muted, #667085)',
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {zone.items.length}
          </span>
        )}
      </div>

      {/* Items */}
      {topItems.length > 0 ? (
        topItems.map((item) => <RadarCard key={item.id} item={item} />)
      ) : (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'var(--p7-color-surface-muted, #F2F6F0)',
            fontSize: 12,
            color: 'var(--p7-color-text-muted, #667085)',
          }}
        >
          {zone.allClearMessage ?? 'Всё в порядке'}
        </div>
      )}

      {!executive && zone.items.length > 3 && (
        <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', paddingLeft: 4 }}>
          +{zone.items.length - 3} ещё
        </span>
      )}
    </div>
  );
}

export function OperatorRadar({
  zones,
  mode = 'operator',
  'data-testid': testId,
}: OperatorRadarProps) {
  const isExecutive = mode === 'executive';

  return (
    <div
      data-testid={testId ?? 'p7-vil-operator-radar'}
      data-mode={mode}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${isExecutive ? '200px' : '180px'}, 1fr))`,
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      {zones.map((zone) => (
        <RadarZoneColumn key={zone.id} zone={zone} executive={isExecutive} />
      ))}
    </div>
  );
}
