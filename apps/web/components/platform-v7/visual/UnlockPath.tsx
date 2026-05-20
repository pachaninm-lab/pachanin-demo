'use client';

import * as React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

/**
 * UnlockPath — путь разблокировки денег.
 *
 * Показывает последовательность шагов для движения денег.
 * Текущий шаг подсвечен, выполненный получает check, следующие приглушены.
 *
 * Использование:
 *   <UnlockPath
 *     title="Чтобы открыть движение денег:"
 *     steps={[
 *       { id: '1', label: 'Закрыть СДИЗ', status: 'done' },
 *       { id: '2', label: 'Подписать акт приёмки', status: 'current' },
 *       { id: '3', label: 'Передать основание банку', status: 'upcoming' },
 *     ]}
 *   />
 */

export type UnlockStepStatus = 'done' | 'current' | 'upcoming';

export interface UnlockStep {
  readonly id: string;
  readonly label: string;
  readonly status: UnlockStepStatus;
  readonly detail?: string;
  readonly action?: { label: string; onClick: () => void };
}

export interface UnlockPathProps {
  readonly title?: string;
  readonly steps: UnlockStep[];
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const STEP_CONFIG: Record<UnlockStepStatus, {
  color: string;
  bg: string;
  border: string;
  numberColor: string;
  opacity: number;
}> = {
  done: {
    color: 'var(--p7-color-success, #027A48)',
    bg: 'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
    numberColor: 'var(--p7-color-success, #027A48)',
    opacity: 0.9,
  },
  current: {
    color: 'var(--p7-color-brand, #0A7A5F)',
    bg: 'var(--p7-color-brand-soft, #E5F4EF)',
    border: 'color-mix(in srgb, var(--p7-color-brand, #0A7A5F) 36%, transparent)',
    numberColor: 'var(--p7-color-brand, #0A7A5F)',
    opacity: 1,
  },
  upcoming: {
    color: 'var(--p7-color-text-secondary, #475569)',
    bg: 'var(--p7-color-surface-muted, #F2F6F0)',
    border: 'var(--p7-color-border, #D7DEE3)',
    numberColor: 'var(--p7-color-text-muted, #667085)',
    opacity: 0.6,
  },
};

function StepItem({ step, index, compact }: { step: UnlockStep; index: number; compact: boolean }) {
  const cfg = STEP_CONFIG[step.status];
  const isDone = step.status === 'done';
  const isCurrent = step.status === 'current';

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: cfg.opacity,
        }}
      >
        {isDone ? (
          <CheckCircle2 size={14} strokeWidth={2} style={{ color: cfg.color, flexShrink: 0 }} />
        ) : isCurrent ? (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: `2px solid ${cfg.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: cfg.bg,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
          </span>
        ) : (
          <Circle size={14} strokeWidth={1.5} style={{ color: cfg.numberColor, flexShrink: 0 }} />
        )}

        <span
          style={{
            fontSize: 12,
            fontWeight: isCurrent ? 800 : 600,
            color: cfg.color,
            lineHeight: 1.35,
          }}
        >
          {step.label}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'flex-start',
        opacity: cfg.opacity,
      }}
    >
      {/* Number/icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `1.5px solid ${cfg.border}`,
            background: isDone ? cfg.bg : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isDone ? (
            <CheckCircle2 size={15} strokeWidth={2} style={{ color: cfg.color }} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 900, color: cfg.numberColor, lineHeight: 1 }}>
              {index + 1}
            </span>
          )}
        </span>
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gap: 4, paddingTop: 4 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: isCurrent ? 850 : 650,
            color: cfg.color,
            lineHeight: 1.35,
          }}
        >
          {step.label}
        </span>

        {step.detail && (
          <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', lineHeight: 1.4 }}>
            {step.detail}
          </span>
        )}

        {step.action && isCurrent && (
          <button
            type='button'
            onClick={step.action.onClick}
            style={{
              alignSelf: 'flex-start',
              marginTop: 4,
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid var(--p7-color-brand, #0A7A5F)',
              background: 'var(--p7-color-brand-soft, #E5F4EF)',
              color: 'var(--p7-color-brand, #0A7A5F)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {step.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function UnlockPath({ title, steps, compact = false, 'data-testid': testId }: UnlockPathProps) {
  if (steps.length === 0) return null;

  if (compact) {
    return (
      <div
        data-testid={testId ?? 'p7-vil-unlock-path'}
        style={{ display: 'grid', gap: 6 }}
      >
        {title && (
          <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </span>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <StepItem step={step} index={index} compact />
              {index < steps.length - 1 && (
                <ArrowRight size={12} style={{ color: 'var(--p7-color-border, #D7DEE3)', flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={testId ?? 'p7-vil-unlock-path'}
      style={{ display: 'grid', gap: 12 }}
    >
      {title && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: 'var(--p7-color-text-secondary, #475569)',
            lineHeight: 1.35,
          }}
        >
          {title}
        </span>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map((step, index) => (
          <StepItem key={step.id} step={step} index={index} compact={false} />
        ))}
      </div>
    </div>
  );
}
