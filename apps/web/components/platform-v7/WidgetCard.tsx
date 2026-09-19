'use client';

import * as React from 'react';
import { ErrorBoundary } from '@/components/error-boundary';

interface WidgetCardProps {
  children: React.ReactNode;
  context?: string;
  className?: string;
  style?: React.CSSProperties;
}

function CardFallback({ reset }: { reset: () => void }) {
  return (
    <div style={{
      padding: '20px',
      border: '1px solid var(--pc-border)',
      borderRadius: 16,
      background: 'var(--pc-bg-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 13, color: 'var(--pc-text-muted)' }}>Не удалось показать блок</span>
      <button
        onClick={reset}
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--pc-accent)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        Перезагрузить
      </button>
    </div>
  );
}

export function WidgetCard({ children, context = 'widget', className, style }: WidgetCardProps) {
  return (
    <ErrorBoundary
      context={context}
      fallback={(_err, reset) => <CardFallback reset={reset} />}
    >
      <div
        className={className}
        style={{
          border: '1px solid var(--pc-border)',
          borderRadius: 16,
          background: 'var(--pc-bg-card)',
          boxShadow: 'var(--pc-shadow-sm)',
          overflow: 'hidden',
          ...style,
        }}
      >
        {children}
      </div>
    </ErrorBoundary>
  );
}
