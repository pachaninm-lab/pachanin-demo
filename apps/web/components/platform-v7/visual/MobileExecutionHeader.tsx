'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, FileText, Truck, Gavel } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * MobileExecutionHeader — компактная execution zone для mobile (390×844).
 *
 * Mobile — не сжатый desktop.
 * Структура:
 *   row 1: уже в AppShell (brand + role)
 *   row 2: Деньги · Доки · Рейс · Спор (pills)
 *   row 3: [только если есть блокер] СДИЗ блокирует 9,65 млн ₽
 *
 * Компонент presentational: данные через props.
 */

export interface MobileExecutionHeaderItem {
  readonly label: string;
  readonly value?: string;
  readonly tone?: 'ok' | 'warn' | 'blocked' | 'money' | 'neutral';
  readonly href?: string;
}

export interface MobileExecutionHeaderBlocker {
  readonly text: string;
  readonly moneyAmount?: string;
  readonly href?: string;
}

export interface MobileExecutionHeaderProps {
  readonly money?: MobileExecutionHeaderItem;
  readonly documents?: MobileExecutionHeaderItem;
  readonly trip?: MobileExecutionHeaderItem;
  readonly dispute?: MobileExecutionHeaderItem;
  readonly blocker?: MobileExecutionHeaderBlocker | null;
  readonly 'data-testid'?: string;
}

const TONE_COLORS = {
  ok:      { color: 'var(--p7-color-success, #027A48)',  border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',  bg: 'var(--p7-color-success-soft, #ECFDF3)' },
  warn:    { color: 'var(--p7-color-warning, #B54708)',  border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',  bg: 'var(--p7-color-warning-soft, #FFFAEB)' },
  blocked: { color: 'var(--p7-color-danger, #B42318)',   border: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',   bg: 'var(--p7-color-danger-soft, #FEF3F2)' },
  money:   { color: 'var(--p7-color-money, #155EEF)',    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',    bg: 'var(--p7-color-money-soft, #EFF4FF)' },
  neutral: { color: 'var(--p7-color-text-muted, #667085)', border: 'var(--pc-border, #D7DEE3)', bg: 'var(--pc-bg-card, #FFFFFF)' },
};

function MobilePill({
  item,
  Icon,
}: {
  item: MobileExecutionHeaderItem;
  Icon: LucideIcon;
}) {
  const tone = item.tone ?? 'neutral';
  const c = TONE_COLORS[tone];

  const inner = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontSize: 11,
        fontWeight: 750,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {item.value ? (
        <span>
          {item.label}
          <span style={{ fontWeight: 800, marginLeft: 3 }}>{item.value}</span>
        </span>
      ) : (
        item.label
      )}
    </span>
  );

  if (item.href) {
    return (
      <Link href={item.href} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export function MobileExecutionHeader({
  money,
  documents,
  trip,
  dispute,
  blocker,
  'data-testid': testId,
}: MobileExecutionHeaderProps) {
  const pills: Array<{
    item: MobileExecutionHeaderItem | undefined;
    Icon: LucideIcon;
  }> = [
    { item: money,     Icon: Banknote },
    { item: documents, Icon: FileText },
    { item: trip,      Icon: Truck },
    { item: dispute,   Icon: Gavel },
  ];

  const visiblePills = pills.filter((p) => p.item);

  if (visiblePills.length === 0 && !blocker) return null;

  return (
    <div
      data-testid={testId ?? 'p7-vil-mobile-execution-header'}
      style={{ display: 'grid', gap: 6 }}
    >
      {/* Row 2: pills */}
      {visiblePills.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 6,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: 2,
          }}
        >
          {visiblePills.map(({ item, Icon }, index) => (
            <MobilePill key={index} item={item!} Icon={Icon} />
          ))}
        </div>
      )}

      {/* Row 3: blocker — только если есть */}
      {blocker && (
        <div>
          {blocker.href ? (
            <Link href={blocker.href} style={{ textDecoration: 'none', display: 'block' }}>
              <BlockerRow blocker={blocker} />
            </Link>
          ) : (
            <BlockerRow blocker={blocker} />
          )}
        </div>
      )}
    </div>
  );
}

function BlockerRow({ blocker }: { blocker: MobileExecutionHeaderBlocker }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',
        background: 'var(--p7-color-danger-soft, #FEF3F2)',
        color: 'var(--p7-color-danger, #B42318)',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.3,
      }}
    >
      <AlertTriangle size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {blocker.text}
        {blocker.moneyAmount && (
          <span style={{ marginLeft: 5, fontWeight: 900 }}>{blocker.moneyAmount}</span>
        )}
      </span>
    </div>
  );
}
