'use client';

import * as React from 'react';
import { MapPin, Camera, Scale, Lock, FlaskConical, FileCheck } from 'lucide-react';

/**
 * ProofRibbon — лента доказательств.
 *
 * Показывает полноту доказательной базы: GPS, Фото, Вес, Пломба, Лаборатория, Акт.
 * Каждый пункт имеет статус: есть / нет / спорно / ждёт.
 *
 * Использование:
 *   <ProofRibbon
 *     items={{
 *       gps: 'present',
 *       photo: 'present',
 *       weight: 'disputed',
 *       seal: 'present',
 *       lab: 'pending',
 *       act: 'absent',
 *     }}
 *   />
 */

export type ProofStatus = 'present' | 'absent' | 'disputed' | 'pending';

export interface ProofRibbonItems {
  readonly gps?: ProofStatus;
  readonly photo?: ProofStatus;
  readonly weight?: ProofStatus;
  readonly seal?: ProofStatus;
  readonly lab?: ProofStatus;
  readonly act?: ProofStatus;
}

export interface ProofRibbonProps {
  readonly items: ProofRibbonItems;
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const PROOF_DEFS: Array<{
  key: keyof ProofRibbonItems;
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
}> = [
  { key: 'gps',    label: 'GPS',        shortLabel: 'GPS',   Icon: MapPin },
  { key: 'photo',  label: 'Фото',       shortLabel: 'Фото',  Icon: Camera },
  { key: 'weight', label: 'Вес',        shortLabel: 'Вес',   Icon: Scale },
  { key: 'seal',   label: 'Пломба',     shortLabel: 'Пломба',Icon: Lock },
  { key: 'lab',    label: 'Лаборатория',shortLabel: 'Лаб',   Icon: FlaskConical },
  { key: 'act',    label: 'Акт',        shortLabel: 'Акт',   Icon: FileCheck },
];

const STATUS_STYLE: Record<ProofStatus, { color: string; bg: string; border: string; label: string }> = {
  present:  {
    color:  'var(--p7-color-success, #027A48)',
    bg:     'var(--p7-color-success-soft, #ECFDF3)',
    border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)',
    label:  'есть',
  },
  absent:   {
    color:  'var(--p7-color-danger, #B42318)',
    bg:     'var(--p7-color-danger-soft, #FEF3F2)',
    border: 'color-mix(in srgb, var(--p7-color-danger, #B42318) 28%, transparent)',
    label:  'нет',
  },
  disputed: {
    color:  'var(--p7-color-dispute, #9F1239)',
    bg:     'var(--p7-color-dispute-soft, #FFF1F2)',
    border: 'color-mix(in srgb, var(--p7-color-dispute, #9F1239) 28%, transparent)',
    label:  'спорно',
  },
  pending:  {
    color:  'var(--p7-color-warning, #B54708)',
    bg:     'var(--p7-color-warning-soft, #FFFAEB)',
    border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
    label:  'ждёт',
  },
};

function ProofItem({
  def,
  status,
  compact,
}: {
  def: (typeof PROOF_DEFS)[number];
  status: ProofStatus;
  compact: boolean;
}) {
  const s = STATUS_STYLE[status];
  const Icon = def.Icon;

  return (
    <span
      title={`${def.label}: ${s.label}`}
      data-status={status}
      style={{
        display: 'inline-flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        gap: compact ? 4 : 3,
        padding: compact ? '3px 7px' : '6px 10px',
        borderRadius: compact ? 8 : 10,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      <Icon size={compact ? 12 : 14} strokeWidth={2.2} />
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 750, lineHeight: 1, whiteSpace: 'nowrap' }}>
        {compact ? def.shortLabel : def.label}
      </span>
      {!compact && (
        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>
          {s.label}
        </span>
      )}
    </span>
  );
}

export function ProofRibbon({ items, compact = false, 'data-testid': testId }: ProofRibbonProps) {
  const visibleItems = PROOF_DEFS.filter((d) => items[d.key] !== undefined);

  if (visibleItems.length === 0) return null;

  const presentCount = visibleItems.filter((d) => items[d.key] === 'present').length;
  const total = visibleItems.length;

  return (
    <div
      data-testid={testId ?? 'p7-vil-proof-ribbon'}
      style={{ display: 'grid', gap: 8 }}
    >
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Доказательства
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 750,
            color: presentCount === total
              ? 'var(--p7-color-success, #027A48)'
              : presentCount > total / 2
              ? 'var(--p7-color-warning, #B54708)'
              : 'var(--p7-color-danger, #B42318)',
          }}>
            {presentCount}/{total} собраны
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: compact ? 4 : 6,
          overflowX: compact ? 'auto' : undefined,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {visibleItems.map((def) => (
          <ProofItem
            key={def.key}
            def={def}
            status={items[def.key]!}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
