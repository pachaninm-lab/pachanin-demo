'use client';

import * as React from 'react';
import { Lock, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TrustDot } from './TrustDot';
import type { TrustDotState } from './TrustDot';

/**
 * MoneyLockHalo — визуально показывает, что сумма стоит / заблокирована / ждёт.
 *
 * Мягкая синяя/жёлтая обводка, тонкая глубина, без неона.
 *
 * Использование:
 *   <MoneyLockHalo
 *     amount="9,65 млн ₽"
 *     lockState="blocked-docs"
 *     reason="заблокировано документами"
 *   />
 *
 *   <MoneyLockHalo amount="624 тыс ₽" lockState="hold" reason="удержание по качеству" />
 *   <MoneyLockHalo amount="12,4 млн ₽" lockState="ready" reason="готово к выпуску" />
 */

export type MoneyLockState =
  | 'blocked-docs'
  | 'blocked-dispute'
  | 'hold'
  | 'manual-review'
  | 'ready'
  | 'released';

export interface MoneyLockHaloProps {
  readonly amount: string;
  readonly lockState: MoneyLockState;
  readonly reason?: string;
  readonly trustState?: TrustDotState;
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const LOCK_CONFIG: Record<MoneyLockState, {
  Icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  halo: string;
  label: string;
}> = {
  'blocked-docs': {
    Icon: Lock,
    color:  'var(--p7-color-money, #155EEF)',
    bg:     'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 36%, transparent)',
    halo:   '0 0 0 4px color-mix(in srgb, var(--p7-color-money, #155EEF) 10%, transparent), 0 4px 16px color-mix(in srgb, var(--p7-color-money, #155EEF) 14%, transparent)',
    label:  'заблокировано',
  },
  'blocked-dispute': {
    Icon: AlertTriangle,
    color:  'var(--p7-color-dispute, #9F1239)',
    bg:     'var(--p7-color-dispute-soft, #FFF1F2)',
    border: 'color-mix(in srgb, var(--p7-color-dispute, #9F1239) 36%, transparent)',
    halo:   '0 0 0 4px color-mix(in srgb, var(--p7-color-dispute, #9F1239) 10%, transparent), 0 4px 16px color-mix(in srgb, var(--p7-color-dispute, #9F1239) 12%, transparent)',
    label:  'блок по спору',
  },
  'hold': {
    Icon: AlertTriangle,
    color:  'var(--p7-color-warning, #B54708)',
    bg:     'var(--p7-color-warning-soft, #FFFAEB)',
    border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 36%, transparent)',
    halo:   '0 0 0 4px color-mix(in srgb, var(--p7-color-warning, #B54708) 10%, transparent), 0 4px 14px color-mix(in srgb, var(--p7-color-warning, #B54708) 12%, transparent)',
    label:  'удержание',
  },
  'manual-review': {
    Icon: Clock,
    color:  'var(--p7-color-money, #155EEF)',
    bg:     'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
    halo:   '0 0 0 3px color-mix(in srgb, var(--p7-color-money, #155EEF) 8%, transparent)',
    label:  'ручная проверка',
  },
  'ready': {
    Icon: CheckCircle2,
    color:  'var(--p7-color-success, #027A48)',
    bg:     'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 36%, transparent)',
    halo:   '0 0 0 4px color-mix(in srgb, var(--p7-color-success, #027A48) 10%, transparent)',
    label:  'готово к выпуску',
  },
  'released': {
    Icon: CheckCircle2,
    color:  'var(--p7-color-success, #027A48)',
    bg:     'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
    halo:   'none',
    label:  'выпущено',
  },
};

export function MoneyLockHalo({
  amount,
  lockState,
  reason,
  trustState = 'test',
  compact = false,
  'data-testid': testId,
}: MoneyLockHaloProps) {
  const cfg = LOCK_CONFIG[lockState];
  const Icon = cfg.Icon;

  if (compact) {
    return (
      <span
        data-testid={testId ?? 'p7-vil-money-lock-halo'}
        data-lock-state={lockState}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px solid ${cfg.border}`,
          background: cfg.bg,
          color: cfg.color,
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          boxShadow: cfg.halo,
        }}
      >
        <Icon size={13} strokeWidth={2.2} />
        <span>{amount}</span>
        {reason && (
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{reason}</span>
        )}
      </span>
    );
  }

  return (
    <div
      data-testid={testId ?? 'p7-vil-money-lock-halo'}
      data-lock-state={lockState}
      style={{
        display: 'grid',
        gap: 6,
        padding: '16px 18px',
        borderRadius: 16,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        boxShadow: cfg.halo,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={16} strokeWidth={2} style={{ color: cfg.color, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: cfg.color,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {amount}
            </span>
          </div>
          {reason && (
            <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color, opacity: 0.85, paddingLeft: 24 }}>
              {reason}
            </span>
          )}
        </div>

        <TrustDot state={trustState} size='xs' />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 999,
          border: `1px solid ${cfg.border}`,
          background: 'transparent',
          color: cfg.color,
          fontSize: 11,
          fontWeight: 750,
          lineHeight: 1.3,
        }}
      >
        {cfg.label}
      </div>
    </div>
  );
}
