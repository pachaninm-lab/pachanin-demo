'use client';

import * as React from 'react';
import { Lightbulb } from 'lucide-react';

/**
 * QuietIntelligenceHint — тихая системная подсказка.
 *
 * НЕ AI-чат. Не интерактивная беседа.
 * Маленькая подсказка в формате: что не так → что сделать → что будет после.
 *
 * Использование:
 *   <QuietIntelligenceHint
 *     problem="Деньги стоят из-за СДИЗ и акта приёмки."
 *     action="Сначала закройте СДИЗ, затем передайте основание банку."
 *     outcome="Деньги перейдут в ручную проверку банка."
 *   />
 */

export interface QuietIntelligenceHintProps {
  readonly problem: string;
  readonly action?: string;
  readonly outcome?: string;
  readonly dismissible?: boolean;
  readonly 'data-testid'?: string;
}

export function QuietIntelligenceHint({
  problem,
  action,
  outcome,
  dismissible = true,
  'data-testid': testId,
}: QuietIntelligenceHintProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div
      data-testid={testId ?? 'p7-vil-quiet-intelligence-hint'}
      style={{
        display: 'grid',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--p7-color-brand, #0A7A5F) 20%, transparent)',
        background: 'var(--p7-color-brand-soft, #E5F4EF)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          <Lightbulb
            size={14}
            strokeWidth={2}
            style={{ color: 'var(--p7-color-brand, #0A7A5F)', flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 650, color: 'var(--p7-color-brand, #0A7A5F)', lineHeight: 1.5 }}>
            {problem}
          </p>
        </div>

        {dismissible && (
          <button
            type='button'
            onClick={() => setDismissed(true)}
            aria-label='Скрыть подсказку'
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--p7-color-brand, #0A7A5F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            ×
          </button>
        )}
      </div>

      {action && (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--p7-color-brand, #0A7A5F)', lineHeight: 1.5, paddingLeft: 22 }}>
          {action}
        </p>
      )}

      {outcome && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--p7-color-brand, #0A7A5F)', lineHeight: 1.5, paddingLeft: 22, opacity: 0.8 }}>
          После: {outcome}
        </p>
      )}
    </div>
  );
}
