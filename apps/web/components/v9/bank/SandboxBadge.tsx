'use client';
import * as React from 'react';
import { cn } from '@/lib/v9/utils';
import { useSessionStore } from '@/stores/useSessionStore';

type SberState = 'live' | 'sandbox' | 'offline';

interface SandboxBadgeProps {
  className?: string;
}

export function SandboxBadge({ className }: SandboxBadgeProps) {
  const demoMode = useSessionStore(s => s.demoMode);
  const state: SberState = demoMode ? 'sandbox' : 'live';

  const labels: Record<SberState, string> = {
    live: 'LIVE',
    sandbox: 'SANDBOX',
    offline: 'OFFLINE',
  };

  const colors: Record<SberState, string> = {
    live: 'bg-[rgba(22,163,74,0.1)] text-success border-[rgba(22,163,74,0.2)]',
    sandbox: 'bg-[rgba(217,119,6,0.1)] text-warning border-[rgba(217,119,6,0.2)]',
    offline: 'bg-muted text-text-muted border-border',
  };

  const dotColors: Record<SberState, string> = {
    live: 'bg-success',
    sandbox: 'bg-warning',
    offline: 'bg-text-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-default',
        colors[state],
        className
      )}
      title={`Номинальный счёт Сбер: ${labels[state]}`}
      aria-label={`Статус банковской интеграции: ${labels[state]}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[state])} aria-hidden />
      Сбер · {labels[state]}
    </span>
  );
}
