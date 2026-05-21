'use client';

import * as React from 'react';

/**
 * SmartSectionSummary — однострочный summary перед большой секцией.
 *
 * Позволяет пользователю понять суть секции без раскрытия деталей.
 *
 * Примеры:
 *   Документы: 7/9 готовы · 2 блокируют деньги
 *   Рейс: в пути · ETA 14:30 · отклонений нет
 *   Качество: протокол ожидается · влияет на удержание
 *   Спор: не открыт · доказательства достаточны
 *
 * Использование:
 *   <SmartSectionSummary
 *     label="Документы"
 *     facts={["7/9 готовы"]}
 *     blockers={["2 блокируют деньги"]}
 *   />
 */

export interface SmartSectionSummaryItem {
  readonly text: string;
  readonly tone?: 'neutral' | 'ok' | 'warn' | 'block' | 'money';
}

export interface SmartSectionSummaryProps {
  readonly label?: string;
  /** Нейтральные факты */
  readonly facts?: string[];
  /** Предупреждения */
  readonly warnings?: string[];
  /** Блокеры */
  readonly blockers?: string[];
  /** Денежный факт */
  readonly moneyFact?: string;
  /** Сводка как массив произвольных items с тонами */
  readonly items?: SmartSectionSummaryItem[];
  readonly 'data-testid'?: string;
  readonly onExpand?: () => void;
  readonly expanded?: boolean;
}

const TONE_COLORS = {
  neutral: { color: 'var(--p7-color-text-muted, #667085)',   bg: 'transparent',                                        border: 'transparent' },
  ok:      { color: 'var(--p7-color-success, #027A48)',      bg: 'var(--p7-color-success-soft, #ECFDF3)',              border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 20%, transparent)' },
  warn:    { color: 'var(--p7-color-warning, #B54708)',      bg: 'var(--p7-color-warning-soft, #FFFAEB)',              border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 20%, transparent)' },
  block:   { color: 'var(--p7-color-danger, #B42318)',       bg: 'var(--p7-color-danger-soft, #FEF3F2)',               border: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 20%, transparent)' },
  money:   { color: 'var(--p7-color-money, #155EEF)',        bg: 'var(--p7-color-money-soft, #EFF4FF)',                border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 20%, transparent)' },
};

function SummaryChip({ text, tone = 'neutral' }: SmartSectionSummaryItem) {
  const c = TONE_COLORS[tone];
  const hasBg = tone !== 'neutral';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: hasBg ? '2px 8px' : '0',
        borderRadius: hasBg ? 999 : 0,
        border: hasBg ? `1px solid ${c.border}` : 'none',
        background: c.bg,
        color: c.color,
        fontSize: 12,
        fontWeight: hasBg ? 750 : 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

export function SmartSectionSummary({
  label,
  facts = [],
  warnings = [],
  blockers = [],
  moneyFact,
  items,
  'data-testid': testId,
  onExpand,
  expanded,
}: SmartSectionSummaryProps) {
  // Если переданы items — используем их напрямую
  const resolvedItems: SmartSectionSummaryItem[] = items ?? [
    ...facts.map((t) => ({ text: t, tone: 'neutral' as const })),
    ...warnings.map((t) => ({ text: t, tone: 'warn' as const })),
    ...blockers.map((t) => ({ text: t, tone: 'block' as const })),
    ...(moneyFact ? [{ text: moneyFact, tone: 'money' as const }] : []),
  ];

  if (resolvedItems.length === 0 && !label) return null;

  const hasPrimary = resolvedItems.length > 0;

  return (
    <div
      data-testid={testId ?? 'p7-vil-smart-section-summary'}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0',
        minHeight: 28,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: 'var(--p7-color-text-primary, #0F1419)',
            whiteSpace: 'nowrap',
            marginRight: hasPrimary ? 2 : 0,
          }}
        >
          {label}
          {hasPrimary ? ':' : ''}
        </span>
      )}

      {resolvedItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span style={{ color: 'var(--p7-color-border, #D7DEE3)', fontSize: 11, userSelect: 'none' }}>·</span>
          )}
          <SummaryChip text={item.text} tone={item.tone} />
        </React.Fragment>
      ))}

      {onExpand && (
        <button
          type='button'
          onClick={onExpand}
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'transparent',
            color: 'var(--p7-color-text-muted, #667085)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {expanded ? 'Свернуть' : 'Детали'}
        </button>
      )}
    </div>
  );
}
