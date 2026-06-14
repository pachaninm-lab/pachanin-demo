'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * CollapsibleSection — премиальная секция «скрыть/раскрыть» (progressive disclosure).
 *
 * Шапка всегда видна (заголовок + опциональная сводка справа + шеврон).
 * Контент остаётся в DOM при сворачивании (доступность и SSR-текст сохраняются),
 * визуально сворачивается через grid-rows. Анимация — только без reduced-motion.
 */
export interface CollapsibleSectionProps {
  readonly title: string;
  /** Короткая сводка справа в шапке, видна и в свёрнутом состоянии */
  readonly summary?: string;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
  readonly 'data-testid'?: string;
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  children,
  'data-testid': testId,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const regionId = React.useId();

  return (
    <section
      data-testid={testId}
      data-open={open ? 'true' : 'false'}
      style={{
        background: 'var(--pc-bg-card, #fff)',
        border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={regionId}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'var(--pc-text-primary, #0F1419)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</span>
        {summary ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pc-text-muted, #58606E)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--pc-text-muted, #58606E)', flexShrink: 0 }}>
          {open ? 'Скрыть' : 'Показать'}
          <ChevronDown
            size={16}
            strokeWidth={2}
            className='p7-collapsible-chevron'
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </span>
      </button>

      <div
        id={regionId}
        role='region'
        hidden={!open}
        className='p7-collapsible-region'
        style={{ padding: open ? '0 18px 18px' : 0 }}
      >
        {children}
      </div>
    </section>
  );
}
