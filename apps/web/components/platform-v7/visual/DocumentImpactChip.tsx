'use client';

import { Banknote, Truck, Gavel, Shield, Minus } from 'lucide-react';

/**
 * DocumentImpactChip — impact-chip у документа.
 *
 * Превращает документ из "файла в списке" в рычаг исполнения.
 * Показывает, на что влияет документ.
 *
 * Использование:
 *   <DocumentImpactChip impact="blocks-money" />
 *   <DocumentImpactChip impact="blocks-trip" label="Блокирует рейс" />
 *   <DocumentImpactChip impact="affects-dispute" />
 *   <DocumentImpactChip impact="strengthens-evidence" />
 *   <DocumentImpactChip impact="not-critical" />
 */

export type DocumentImpact =
  | 'blocks-money'
  | 'blocks-trip'
  | 'affects-dispute'
  | 'strengthens-evidence'
  | 'not-critical';

export interface DocumentImpactChipProps {
  readonly impact: DocumentImpact;
  readonly label?: string;
  readonly size?: 'xs' | 'sm';
  readonly 'data-testid'?: string;
}

const IMPACT_CONFIG: Record<DocumentImpact, {
  defaultLabel: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
}> = {
  'blocks-money': {
    defaultLabel: 'блокирует деньги',
    color: 'var(--p7-color-money, #155EEF)',
    bg: 'var(--p7-color-money-soft, #EFF4FF)',
    border: 'color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
    Icon: Banknote,
  },
  'blocks-trip': {
    defaultLabel: 'блокирует рейс',
    color: 'var(--p7-color-logistics, #5B21B6)',
    bg: 'var(--p7-color-logistics-soft, #F5F3FF)',
    border: 'color-mix(in srgb, var(--p7-color-logistics, #5B21B6) 28%, transparent)',
    Icon: Truck,
  },
  'affects-dispute': {
    defaultLabel: 'влияет на спор',
    color: 'var(--p7-color-dispute, #9F1239)',
    bg: 'var(--p7-color-dispute-soft, #FFF1F2)',
    border: 'color-mix(in srgb, var(--p7-color-dispute, #9F1239) 28%, transparent)',
    Icon: Gavel,
  },
  'strengthens-evidence': {
    defaultLabel: 'усиливает доказательства',
    color: 'var(--p7-color-evidence, #6941C6)',
    bg: 'var(--p7-color-evidence-soft, #F4F3FF)',
    border: 'color-mix(in srgb, var(--p7-color-evidence, #6941C6) 28%, transparent)',
    Icon: Shield,
  },
  'not-critical': {
    defaultLabel: 'не критично',
    color: 'var(--p7-color-text-muted, #667085)',
    bg: 'var(--p7-color-surface-muted, #F2F6F0)',
    border: 'var(--p7-color-border, #D7DEE3)',
    Icon: Minus,
  },
};

const SIZE_MAP = {
  xs: { icon: 11, font: 10, gap: 4, padding: '2px 6px', radius: 6 },
  sm: { icon: 12, font: 11, gap: 5, padding: '3px 8px', radius: 8 },
};

export function DocumentImpactChip({
  impact,
  label,
  size = 'sm',
  'data-testid': testId,
}: DocumentImpactChipProps) {
  const cfg = IMPACT_CONFIG[impact];
  const sz = SIZE_MAP[size];
  const resolvedLabel = label ?? cfg.defaultLabel;

  return (
    <span
      data-testid={testId ?? 'p7-vil-doc-impact-chip'}
      data-impact={impact}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sz.gap,
        padding: sz.padding,
        borderRadius: sz.radius,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.color,
        fontSize: sz.font,
        fontWeight: 750,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <cfg.Icon size={sz.icon} strokeWidth={2.2} />
      {resolvedLabel}
    </span>
  );
}

/**
 * DocumentImpactChipList — несколько chips рядом.
 */
export function DocumentImpactChipList({
  impacts,
  size = 'sm',
}: {
  impacts: DocumentImpact[];
  size?: 'xs' | 'sm';
}) {
  if (impacts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {impacts.map((impact) => (
        <DocumentImpactChip key={impact} impact={impact} size={size} />
      ))}
    </div>
  );
}
