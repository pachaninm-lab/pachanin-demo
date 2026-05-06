'use client';
import * as React from 'react';
import { cn } from '@/lib/v9/utils';
import { useSessionStore } from '@/stores/useSessionStore';

type BankContourState = 'pilot' | 'test' | 'unavailable';

interface SandboxBadgeProps {
  className?: string;
}

export function SandboxBadge({ className }: SandboxBadgeProps) {
  const demoMode = useSessionStore(s => s.demoMode);
  const state: BankContourState = demoMode ? 'test' : 'pilot';

  const labels: Record<BankContourState, string> = {
    pilot: 'пилотный режим',
    test: 'тестовый контур',
    unavailable: 'нет связи',
  };

  const colors: Record<BankContourState, string> = {
    pilot: 'bg-[rgba(217,119,6,0.1)] text-warning border-[rgba(217,119,6,0.2)]',
    test: 'bg-[rgba(37,99,235,0.1)] text-info border-[rgba(37,99,235,0.2)]',
    unavailable: 'bg-muted text-text-muted border-border',
  };

  const dotColors: Record<BankContourState, string> = {
    pilot: 'bg-warning',
    test: 'bg-info',
    unavailable: 'bg-text-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-default',
        colors[state],
        className
      )}
      title={`Банковый контур: ${labels[state]}. Не промышленная эксплуатация.`}
      aria-label={`Статус банкового контура: ${labels[state]}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[state])} aria-hidden />
      Банк · {labels[state]}
    </span>
  );
}
