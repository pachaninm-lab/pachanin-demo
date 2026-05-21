'use client';

import * as React from 'react';

/**
 * FocusDetailMode — переключатель режима просмотра: Главное / Детали.
 *
 * "Главное" показывает: статус, деньги, главный блокер, ответственный, следующее действие.
 * "Детали" раскрывает: документы, рейс, качество, спор, доказательства, журнал.
 *
 * Использование:
 *   const [mode, setMode] = React.useState<FocusMode>('focus');
 *   <FocusDetailMode mode={mode} onChange={setMode} />
 *   {mode === 'focus' ? <FocusView /> : <DetailView />}
 */

export type FocusMode = 'focus' | 'detail';

export interface FocusDetailModeProps {
  readonly mode: FocusMode;
  readonly onChange: (mode: FocusMode) => void;
  readonly focusLabel?: string;
  readonly detailLabel?: string;
  readonly 'data-testid'?: string;
}

export function FocusDetailMode({
  mode,
  onChange,
  focusLabel = 'Главное',
  detailLabel = 'Детали',
  'data-testid': testId,
}: FocusDetailModeProps) {
  return (
    <div
      data-testid={testId ?? 'p7-vil-focus-detail-mode'}
      role='group'
      aria-label='Режим отображения'
      style={{
        display: 'inline-flex',
        borderRadius: 10,
        border: '1px solid var(--pc-border, #D7DEE3)',
        background: 'var(--pc-bg-card, #FFFFFF)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {(['focus', 'detail'] as FocusMode[]).map((m) => {
        const isActive = mode === m;
        const label = m === 'focus' ? focusLabel : detailLabel;
        return (
          <button
            key={m}
            type='button'
            role='radio'
            aria-checked={isActive}
            onClick={() => onChange(m)}
            style={{
              padding: '5px 12px',
              border: 'none',
              background: isActive
                ? 'var(--pc-accent-bg, rgba(11,122,95,0.08))'
                : 'transparent',
              color: isActive
                ? 'var(--p7-color-brand, #0A7A5F)'
                : 'var(--p7-color-text-muted, #667085)',
              fontSize: 12,
              fontWeight: isActive ? 850 : 650,
              cursor: 'pointer',
              lineHeight: 1.4,
              borderRight: m === 'focus' ? '1px solid var(--pc-border, #D7DEE3)' : 'none',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * FocusDetailSection — секция с поддержкой FocusDetailMode.
 * Рендерит содержимое только в нужном режиме.
 */
export interface FocusDetailSectionProps {
  readonly mode: FocusMode;
  readonly showIn: FocusMode | 'both';
  readonly children: React.ReactNode;
}

export function FocusDetailSection({ mode, showIn, children }: FocusDetailSectionProps) {
  if (showIn === 'both') return <>{children}</>;
  if (mode !== showIn) return null;
  return <>{children}</>;
}
