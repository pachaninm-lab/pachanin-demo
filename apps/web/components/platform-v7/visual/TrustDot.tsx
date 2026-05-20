'use client';

import * as React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Wrench } from 'lucide-react';

/**
 * TrustDot — мини-индикатор источника и статуса верификации.
 *
 * Заменяет длинные дисклеймеры рядом с важными суммами и статусами.
 * При наведении показывает tooltip с объяснением источника.
 *
 * Использование:
 *   <TrustDot state="confirmed" />
 *   <TrustDot state="pending" tooltip="Ожидает банковского подтверждения" />
 *   <TrustDot state="manual" />
 *   <TrustDot state="test" />
 *   <TrustDot state="confirmed" label="Банк подтвердил" />
 */

export type TrustDotState = 'confirmed' | 'pending' | 'manual' | 'test';

export interface TrustDotProps {
  readonly state: TrustDotState;
  /** Переопределить tooltip текст */
  readonly tooltip?: string;
  /** Показывать label рядом с точкой */
  readonly label?: string;
  readonly size?: 'xs' | 'sm' | 'md';
  readonly 'data-testid'?: string;
}

const STATE_CONFIG: Record<TrustDotState, {
  color: string;
  bg: string;
  border: string;
  defaultTooltip: string;
  defaultLabel: string;
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
}> = {
  confirmed: {
    color: 'var(--p7-color-success, #027A48)',
    bg: 'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
    defaultTooltip: 'Подтверждено внешней системой.',
    defaultLabel: 'подтверждено',
    Icon: CheckCircle2,
  },
  pending: {
    color: 'var(--p7-color-warning, #B54708)',
    bg: 'var(--p7-color-warning-soft, #FFFAEB)',
    border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
    defaultTooltip: 'Ожидает внешнего события или подтверждения.',
    defaultLabel: 'ожидает',
    Icon: Clock,
  },
  manual: {
    color: 'var(--p7-color-money, #155EEF)',
    bg: 'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
    defaultTooltip: 'Данные требуют ручной проверки банком или оператором.',
    defaultLabel: 'ручная проверка',
    Icon: AlertTriangle,
  },
  test: {
    color: 'var(--p7-color-text-muted, #667085)',
    bg: 'var(--p7-color-surface-muted, #F2F6F0)',
    border: 'var(--p7-color-border, #D7DEE3)',
    defaultTooltip:
      'Источник: тестовый контур сделки. Внешнее подтверждение требует договоров, доступов и проверки на реальных сделках.',
    defaultLabel: 'тестовый контур',
    Icon: Wrench,
  },
};

const SIZE_MAP = {
  xs: { dot: 6, icon: 10, font: 10, gap: 4, padding: '2px 6px' },
  sm: { dot: 8, icon: 12, font: 11, gap: 5, padding: '3px 7px' },
  md: { dot: 10, icon: 13, font: 12, gap: 6, padding: '4px 8px' },
};

export function TrustDot({
  state,
  tooltip,
  label,
  size = 'sm',
  'data-testid': testId,
}: TrustDotProps) {
  const [tooltipVisible, setTooltipVisible] = React.useState(false);
  const cfg = STATE_CONFIG[state];
  const sz = SIZE_MAP[size];
  const resolvedTooltip = tooltip ?? cfg.defaultTooltip;
  const resolvedLabel = label ?? (size === 'md' ? cfg.defaultLabel : undefined);

  return (
    <span
      role='status'
      aria-label={resolvedTooltip}
      data-testid={testId ?? 'p7-vil-trust-dot'}
      data-state={state}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: sz.gap, cursor: 'default' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: sz.gap,
          padding: resolvedLabel ? sz.padding : '0',
          borderRadius: resolvedLabel ? 999 : '50%',
          border: `1px solid ${cfg.border}`,
          background: cfg.bg,
          color: cfg.color,
          fontSize: sz.font,
          fontWeight: 750,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {resolvedLabel ? (
          <>
            <cfg.Icon size={sz.icon} strokeWidth={2.2} />
            {resolvedLabel}
          </>
        ) : (
          <span
            style={{
              display: 'block',
              width: sz.dot,
              height: sz.dot,
              borderRadius: '50%',
              background: cfg.color,
              flexShrink: 0,
            }}
          />
        )}
      </span>

      {tooltipVisible && (
        <span
          role='tooltip'
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            width: 240,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'var(--pc-bg-card, #FFFFFF)',
            border: '1px solid var(--pc-border, #D7DEE3)',
            boxShadow: '0 8px 24px rgba(15,20,25,0.12)',
            color: 'var(--p7-color-text-secondary, #475569)',
            fontSize: 11,
            lineHeight: 1.5,
            fontWeight: 500,
            zIndex: 200,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {resolvedTooltip}
        </span>
      )}
    </span>
  );
}
