'use client';
import * as React from 'react';
import { cn } from '@/lib/v9/utils';
import { Skeleton } from '../ui/skeleton';

export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger';

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  delta?: string;
  deltaPositive?: boolean;
  sub?: React.ReactNode;
  tone?: KpiTone;
  loading?: boolean;
  onClick?: () => void;
  progress?: number; // 0–100
  'data-testid'?: string;
}

const toneStyles: Record<KpiTone, { border: string; valueCls: string }> = {
  neutral: { border: 'border-border', valueCls: 'text-text-primary' },
  success: { border: 'border-[rgba(22,163,74,0.3)]', valueCls: 'text-success' },
  warning: { border: 'border-[rgba(217,119,6,0.3)]', valueCls: 'text-warning' },
  danger: { border: 'border-[rgba(220,38,38,0.3)]', valueCls: 'text-danger' },
};

const toneProgressBg: Record<KpiTone, string> = {
  neutral: '#0A7A5F',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

export function KpiCard({
  title, value, delta, deltaPositive, sub,
  tone = 'neutral', loading, onClick, progress,
  'data-testid': testId,
}: KpiCardProps) {
  const { border, valueCls } = toneStyles[tone];

  if (loading) {
    return (
      <div className={cn('v9-card', border)} data-testid={testId}>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  return (
    <article
      className={cn(
        'v9-card border',
        border,
        onClick && 'cursor-pointer hover:shadow-md transition-shadow'
      )}
      onClick={onClick}
      data-testid={testId}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`${title}: ${typeof value === 'string' ? value : ''}`}
    >
      {/* Title */}
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
        {title}
      </div>

      {/* Value */}
      <div className={cn('font-mono text-2xl font-bold leading-tight mb-1', valueCls)}>
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div className={cn(
          'text-xs font-semibold mb-2',
          deltaPositive === true ? 'text-success'
          : deltaPositive === false ? 'text-danger'
          : 'text-text-muted'
        )}>
          {deltaPositive === true ? '↑ ' : deltaPositive === false ? '↓ ' : ''}{delta}
        </div>
      )}

      {/* Sub label */}
      {sub && (
        <div className="text-xs text-text-muted">{sub}</div>
      )}

      {/* Progress bar */}
      {typeof progress === 'number' && (
        <div
          className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title}: ${progress}%`}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: toneProgressBg[tone],
              borderRadius: 999,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      )}
    </article>
  );
}
