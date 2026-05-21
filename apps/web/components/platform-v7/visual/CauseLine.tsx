'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * CauseLine — главная визуальная ДНК платформы.
 * Показывает причинную связь: причина → влияние → деньги.
 *
 * Примеры:
 *   СДИЗ не закрыт ── блокирует ── выпуск 9,65 млн ₽
 *   Лаборатория не закрыта ── влияет ── удержание 624 тыс ₽
 *   Акт приёмки подписан ── открывает ── основание банку
 *
 * Desktop: горизонтальная линия причинности
 * Mobile: компактная cause-card (причина → влияние → деньги → действие)
 *
 * Компонент presentational, hover подсвечивает связанные элементы
 * через CSS data-attributes (реализуется через CSS в final-polish.css).
 */

export type CauseLineRelation = 'blocks' | 'affects' | 'opens' | 'requires' | 'enables';
export type CauseLineTone = 'blocked' | 'warning' | 'ok' | 'money' | 'neutral';

export interface CauseLineNode {
  readonly text: string;
  readonly tone?: CauseLineTone;
  readonly href?: string;
}

export interface CauseLineProps {
  readonly cause: CauseLineNode;
  readonly relation: CauseLineRelation;
  readonly effect: CauseLineNode;
  /** Денежная сумма, если связана с деньгами */
  readonly moneyAmount?: string;
  readonly moneyTone?: 'blocked' | 'hold' | 'release' | 'neutral';
  /** Compact mode для mobile */
  readonly compact?: boolean;
  /** action CTA */
  readonly action?: { label: string; onClick: () => void };
  readonly 'data-testid'?: string;
  readonly className?: string;
}

const RELATION_LABELS: Record<CauseLineRelation, string> = {
  blocks:   'блокирует',
  affects:  'влияет →',
  opens:    'открывает',
  requires: 'требует',
  enables:  'обеспечивает',
};

const TONE_COLORS: Record<CauseLineTone, { color: string; bg: string; border: string }> = {
  blocked: {
    color:  'var(--p7-color-danger, #B42318)',
    bg:     'var(--p7-color-danger-soft, #FEF3F2)',
    border: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',
  },
  warning: {
    color:  'var(--p7-color-warning, #B54708)',
    bg:     'var(--p7-color-warning-soft, #FFFAEB)',
    border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
  },
  ok: {
    color:  'var(--p7-color-success, #027A48)',
    bg:     'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
  },
  money: {
    color:  'var(--p7-color-money, #155EEF)',
    bg:     'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
  },
  neutral: {
    color:  'var(--p7-color-text-secondary, #475569)',
    bg:     'var(--p7-color-surface-muted, #F2F6F0)',
    border: 'var(--p7-color-border, #D7DEE3)',
  },
};

const MONEY_TONE_COLORS: Record<NonNullable<CauseLineProps['moneyTone']>, { color: string; bg: string; border: string }> = {
  blocked: {
    color:  'var(--p7-color-money, #155EEF)',
    bg:     'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
  },
  hold: {
    color:  'var(--p7-color-warning, #B54708)',
    bg:     'var(--p7-color-warning-soft, #FFFAEB)',
    border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
  },
  release: {
    color:  'var(--p7-color-success, #027A48)',
    bg:     'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
  },
  neutral: {
    color:  'var(--p7-color-text-secondary, #475569)',
    bg:     'var(--p7-color-surface-muted, #F2F6F0)',
    border: 'var(--p7-color-border, #D7DEE3)',
  },
};

function NodeChip({ node, small = false }: { node: CauseLineNode; small?: boolean }) {
  const tone = node.tone ?? 'neutral';
  const c = TONE_COLORS[tone];

  const inner = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: small ? '3px 8px' : '5px 10px',
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontSize: small ? 11 : 12,
        fontWeight: 750,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
      }}
    >
      {node.text}
    </span>
  );

  return inner;
}

export function CauseLine({
  cause,
  relation,
  effect,
  moneyAmount,
  moneyTone = 'blocked',
  compact = false,
  action,
  'data-testid': testId,
  className,
}: CauseLineProps) {
  const relationLabel = RELATION_LABELS[relation];
  const moneyColors = moneyAmount ? MONEY_TONE_COLORS[moneyTone] : null;

  if (compact) {
    // Mobile: compact cause-card
    return (
      <div
        data-testid={testId ?? 'p7-vil-cause-line'}
        data-compact='true'
        className={className}
        style={{
          display: 'grid',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid var(--p7-color-border, #D7DEE3)',
          background: 'var(--p7-color-surface, #FFFFFF)',
        }}
      >
        {/* cause → effect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <NodeChip node={cause} small />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--p7-color-text-muted, #667085)', flexShrink: 0 }}>
            {relationLabel}
          </span>
          <NodeChip node={effect} small />
        </div>

        {/* money row */}
        {moneyAmount && moneyColors && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', fontWeight: 600 }}>Деньги:</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                border: `1px solid ${moneyColors.border}`,
                background: moneyColors.bg,
                color: moneyColors.color,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {moneyAmount}
            </span>
          </div>
        )}

        {/* action */}
        {action && (
          <button
            type='button'
            onClick={action.onClick}
            style={{
              alignSelf: 'flex-start',
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid var(--p7-color-border, #D7DEE3)',
              background: 'var(--pc-bg-card, #FFFFFF)',
              color: 'var(--p7-color-brand, #0A7A5F)',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  // Desktop: горизонтальная линия причинности
  return (
    <div
      data-testid={testId ?? 'p7-vil-cause-line'}
      data-compact='false'
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '6px 0',
        minWidth: 0,
      }}
    >
      <NodeChip node={cause} />

      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--p7-color-text-muted, #667085)',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        <ConnectorLine />
        {relationLabel}
        <ConnectorLine />
      </span>

      <NodeChip node={effect} />

      {moneyAmount && moneyColors && (
        <>
          <ArrowRight size={13} style={{ color: 'var(--p7-color-text-muted, #667085)', flexShrink: 0 }} />
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              border: `1px solid ${moneyColors.border}`,
              background: moneyColors.bg,
              color: moneyColors.color,
              fontSize: 13,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {moneyAmount}
          </span>
        </>
      )}

      {action && (
        <button
          type='button'
          onClick={action.onClick}
          style={{
            marginLeft: 8,
            padding: '4px 12px',
            borderRadius: 8,
            border: '1px solid var(--p7-color-brand, #0A7A5F)',
            background: 'transparent',
            color: 'var(--p7-color-brand, #0A7A5F)',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function ConnectorLine() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 20,
        height: 1,
        background: 'var(--p7-color-border, #D7DEE3)',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * CauseLineList — несколько CauseLine в стеке.
 */
export function CauseLineList({ items, compact }: { items: CauseLineProps[]; compact?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 6 }}>
      {items.map((item, index) => (
        <CauseLine key={index} {...item} compact={compact} />
      ))}
    </div>
  );
}
