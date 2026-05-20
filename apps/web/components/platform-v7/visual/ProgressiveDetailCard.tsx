'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ProgressiveDetailCard — карточка с прогрессивным раскрытием.
 *
 * Шапка всегда видна: название, статус, короткий факт, блокер, следующий шаг.
 * Детали раскрываются по клику.
 *
 * Каждая карточка должна отвечать:
 *   1. Название
 *   2. Статус
 *   3. Короткий факт
 *   4. Что блокирует
 *   5. Следующий шаг
 *   6. Действие
 */

export interface ProgressiveDetailCardProps {
  readonly title: string;
  readonly status?: string;
  readonly statusTone?: 'ok' | 'warn' | 'blocked' | 'money' | 'neutral';
  readonly fact?: string;
  readonly blocker?: string;
  readonly nextStep?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly children?: React.ReactNode;
  readonly defaultExpanded?: boolean;
  readonly surface?: 'card' | 'plain';
  readonly 'data-testid'?: string;
}

const STATUS_TONE_COLORS = {
  ok:      { color: 'var(--p7-color-success, #027A48)',  bg: 'var(--p7-color-success-soft, #ECFDF3)',  border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)' },
  warn:    { color: 'var(--p7-color-warning, #B54708)',  bg: 'var(--p7-color-warning-soft, #FFFAEB)',  border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)' },
  blocked: { color: 'var(--p7-color-danger, #B42318)',   bg: 'var(--p7-color-danger-soft, #FEF3F2)',   border: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)' },
  money:   { color: 'var(--p7-color-money, #155EEF)',    bg: 'var(--p7-color-money-soft, #EFF4FF)',    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)' },
  neutral: { color: 'var(--p7-color-text-muted, #667085)', bg: 'var(--p7-color-surface-muted, #F2F6F0)', border: 'var(--p7-color-border, #D7DEE3)' },
};

export function ProgressiveDetailCard({
  title,
  status,
  statusTone = 'neutral',
  fact,
  blocker,
  nextStep,
  actionLabel,
  onAction,
  children,
  defaultExpanded = false,
  surface = 'card',
  'data-testid': testId,
}: ProgressiveDetailCardProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const hasDetails = !!children || !!nextStep || !!blocker;
  const sc = STATUS_TONE_COLORS[statusTone];

  return (
    <div
      data-testid={testId ?? 'p7-vil-progressive-detail-card'}
      style={{
        borderRadius: 14,
        border: surface === 'card' ? `1px solid ${sc.border}` : '1px solid var(--p7-color-border, #D7DEE3)',
        background: 'var(--p7-color-surface, #FFFFFF)',
        overflow: 'hidden',
      }}
    >
      {/* Always-visible header */}
      <div
        style={{
          display: 'grid',
          gap: 8,
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 850, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.35 }}>
              {title}
            </span>

            {status && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: `1px solid ${sc.border}`,
                  background: sc.bg,
                  color: sc.color,
                  fontSize: 11,
                  fontWeight: 750,
                  lineHeight: 1.3,
                }}
              >
                {status}
              </span>
            )}

            {fact && (
              <span style={{ fontSize: 12, color: 'var(--p7-color-text-secondary, #475569)', lineHeight: 1.4 }}>
                {fact}
              </span>
            )}
          </div>

          {/* Expand toggle */}
          {hasDetails && (
            <button
              type='button'
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid var(--p7-color-border, #D7DEE3)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--p7-color-text-muted, #667085)',
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {/* Blocker - visible in collapsed mode */}
        {blocker && !expanded && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 750,
              color: 'var(--p7-color-danger, #B42318)',
              lineHeight: 1.4,
              paddingLeft: 8,
              borderLeft: '2px solid var(--p7-color-danger, #B42318)',
            }}
          >
            {blocker}
          </span>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div
          style={{
            padding: '0 14px 14px',
            display: 'grid',
            gap: 10,
            borderTop: '1px solid var(--p7-color-border, #D7DEE3)',
            paddingTop: 12,
          }}
        >
          {blocker && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 9,
                background: 'var(--p7-color-danger-soft, #FEF3F2)',
                fontSize: 12,
                color: 'var(--p7-color-danger, #B42318)',
                fontWeight: 650,
                lineHeight: 1.4,
              }}
            >
              Блокер: {blocker}
            </div>
          )}

          {nextStep && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 9,
                background: 'var(--p7-color-brand-soft, #E5F4EF)',
                fontSize: 12,
                color: 'var(--p7-color-brand, #0A7A5F)',
                fontWeight: 650,
                lineHeight: 1.4,
              }}
            >
              Следующий шаг: {nextStep}
            </div>
          )}

          {children}

          {actionLabel && onAction && (
            <button
              type='button'
              onClick={onAction}
              style={{
                alignSelf: 'flex-start',
                padding: '7px 14px',
                borderRadius: 10,
                border: '1px solid var(--p7-color-brand, #0A7A5F)',
                background: 'var(--p7-color-brand, #0A7A5F)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 850,
                cursor: 'pointer',
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
