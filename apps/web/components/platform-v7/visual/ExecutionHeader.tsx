'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, FileText, Truck, FlaskConical, Gavel, AlertTriangle } from 'lucide-react';
import { TrustDot } from './TrustDot';
import type { TrustDotState } from './TrustDot';

/**
 * ExecutionHeader — живая панель исполнения сделки (Execution Zone в шапке).
 *
 * Показывает в шапке: деньги · документы · рейс · качество · спор
 * + активный блокер (если есть) + активная роль + TrustDot.
 *
 * Это НЕ замена AppShellV4 — это дополнительная полоска Execution Zone,
 * которую можно встроить внутрь AppShellV4 header.
 *
 * Компонент presentational: данные получает через props, не fetches сам.
 */

export interface ExecutionZoneItem {
  readonly label: string;
  readonly value?: string;
  readonly tone?: 'ok' | 'warn' | 'blocked' | 'money' | 'neutral';
  readonly href?: string;
}

export interface ExecutionHeaderBlocker {
  readonly text: string;
  readonly moneyAmount?: string;
  /** href для перехода к блокеру */
  readonly href?: string;
}

export interface ExecutionHeaderProps {
  readonly roleLabel?: string;
  readonly money?: ExecutionZoneItem;
  readonly documents?: ExecutionZoneItem;
  readonly trip?: ExecutionZoneItem;
  readonly quality?: ExecutionZoneItem;
  readonly dispute?: ExecutionZoneItem;
  /** Главный блокер (отображается только если есть) */
  readonly blocker?: ExecutionHeaderBlocker | null;
  readonly trustState?: TrustDotState;
  /** Уменьшенный режим (при скролле) */
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const TONE_COLORS = {
  ok:      { color: 'var(--p7-color-success, #027A48)', bg: 'transparent' },
  warn:    { color: 'var(--p7-color-warning, #B54708)', bg: 'transparent' },
  blocked: { color: 'var(--p7-color-danger, #B42318)',  bg: 'transparent' },
  money:   { color: 'var(--p7-color-money, #155EEF)',   bg: 'transparent' },
  neutral: { color: 'var(--p7-color-text-muted, #667085)', bg: 'transparent' },
};

function ZoneItem({
  label,
  value,
  tone = 'neutral',
  href,
  Icon,
  compact,
}: ExecutionZoneItem & {
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  compact: boolean;
}) {
  const c = TONE_COLORS[tone];

  const inner = (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: compact ? '0 8px' : '4px 10px',
        borderRadius: 8,
        cursor: href ? 'pointer' : 'default',
        transition: 'background 0.12s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.color }}>
        <Icon size={compact ? 12 : 13} strokeWidth={2} />
        {!compact && (
          <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>
            {label}
          </span>
        )}
      </span>
      {value && (
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: c.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {value}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={`${label}${value ? ': ' + value : ''}`}
        style={{ textDecoration: 'none' }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ExecutionHeader({
  roleLabel,
  money,
  documents,
  trip,
  quality,
  dispute,
  blocker,
  trustState = 'test',
  compact = false,
  'data-testid': testId,
}: ExecutionHeaderProps) {
  const zones: Array<{
    item: ExecutionZoneItem | undefined;
    Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  }> = [
    { item: money,     Icon: Banknote },
    { item: documents, Icon: FileText },
    { item: trip,      Icon: Truck },
    { item: quality,   Icon: FlaskConical },
    { item: dispute,   Icon: Gavel },
  ];

  const visibleZones = zones.filter((z) => z.item);

  if (visibleZones.length === 0 && !blocker && !roleLabel) return null;

  return (
    <div
      data-testid={testId ?? 'p7-vil-execution-header'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'nowrap',
        overflow: 'hidden',
        minWidth: 0,
        padding: compact ? '0' : '2px 0',
      }}
    >
      {/* Execution zone items */}
      {visibleZones.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            borderRadius: 10,
            border: '1px solid var(--pc-border, #D7DEE3)',
            background: 'var(--pc-bg-card, #FFFFFF)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {visibleZones.map(({ item, Icon }, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--pc-border, #D7DEE3)', flexShrink: 0 }} />
              )}
              <ZoneItem {...item!} Icon={Icon} compact={compact} />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Blocker alert */}
      {blocker && (
        <React.Fragment>
          <span style={{ color: 'var(--pc-border, #D7DEE3)', fontSize: 14, userSelect: 'none', flexShrink: 0, marginLeft: 4 }}>·</span>
          {blocker.href ? (
            <Link
              href={blocker.href}
              style={{ textDecoration: 'none', flexShrink: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <BlockerBadge blocker={blocker} compact={compact} />
            </Link>
          ) : (
            <BlockerBadge blocker={blocker} compact={compact} />
          )}
        </React.Fragment>
      )}

      {/* Role label */}
      {roleLabel && !compact && (
        <span
          style={{
            marginLeft: 4,
            flexShrink: 0,
            padding: '4px 9px',
            borderRadius: 8,
            border: '1px solid var(--pc-border, #D7DEE3)',
            background: 'var(--pc-bg-card)',
            fontSize: 11,
            fontWeight: 850,
            color: 'var(--p7-color-text-muted, #667085)',
            whiteSpace: 'nowrap',
          }}
        >
          {roleLabel}
        </span>
      )}

      {/* TrustDot */}
      <span style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 6 }}>
        <TrustDot state={trustState} size='xs' />
      </span>
    </div>
  );
}

function BlockerBadge({ blocker, compact }: { blocker: ExecutionHeaderBlocker; compact: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: compact ? '3px 8px' : '4px 10px',
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',
        background: 'var(--p7-color-danger-soft, #FEF3F2)',
        color: 'var(--p7-color-danger, #B42318)',
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 260,
        flexShrink: 1,
      }}
    >
      <AlertTriangle size={compact ? 11 : 12} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {blocker.text}
        {blocker.moneyAmount && (
          <span style={{ fontWeight: 700, marginLeft: 4, opacity: 0.9 }}>{blocker.moneyAmount}</span>
        )}
      </span>
    </span>
  );
}
