'use client';

import * as React from 'react';
import { MapPin, Camera, Scale, Lock, FlaskConical, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * EvidenceStrengthMeter — технический индекс полноты доказательной базы.
 *
 * ВАЖНО: это техническая полнота доказательств конкретной сделки,
 * НЕ рейтинг честности человека.
 *
 * Использование:
 *   <EvidenceStrengthMeter
 *     score={82}
 *     factors={[
 *       { id: 'gps',   label: 'GPS',       points: 20, earned: 20 },
 *       { id: 'photo', label: 'Фото',       points: 15, earned: 15 },
 *       { id: 'weight',label: 'Вес',        points: 20, earned: 20 },
 *       { id: 'seal',  label: 'Пломба',     points: 15, earned: 15 },
 *       { id: 'lab',   label: 'Лаборатория',points: 20, earned: 0 },
 *       { id: 'act',   label: 'Акт',        points: 10, earned: 12 },
 *     ]}
 *   />
 */

export interface EvidenceFactor {
  readonly id: string;
  readonly label: string;
  readonly points: number;
  readonly earned: number;
  readonly status?: 'present' | 'absent' | 'disputed' | 'pending';
}

export interface EvidenceStrengthMeterProps {
  readonly score: number;
  readonly maxScore?: number;
  readonly factors?: EvidenceFactor[];
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const FACTOR_ICONS: Record<string, LucideIcon> = {
  gps:    MapPin,
  photo:  Camera,
  weight: Scale,
  seal:   Lock,
  lab:    FlaskConical,
  act:    FileCheck,
};

function scoreColor(score: number, max: number): { bar: string; text: string } {
  const pct = score / max;
  if (pct >= 0.8) return { bar: 'var(--p7-color-success, #027A48)',  text: 'var(--p7-color-success, #027A48)' };
  if (pct >= 0.5) return { bar: 'var(--p7-color-warning, #B54708)', text: 'var(--p7-color-warning, #B54708)' };
  return { bar: 'var(--p7-color-danger, #B42318)', text: 'var(--p7-color-danger, #B42318)' };
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(1, Math.max(0, score / max));
  const c = scoreColor(score, max);
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: 'var(--p7-color-surface-muted, #F2F6F0)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct * 100}%`,
          borderRadius: 999,
          background: c.bar,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

function FactorRow({ factor }: { factor: EvidenceFactor }) {
  const Icon = FACTOR_ICONS[factor.id] ?? FileCheck;
  const earnedPct = factor.points > 0 ? Math.min(1, factor.earned / factor.points) : 0;
  const isEarned = factor.earned > 0;
  const isAbsent = factor.status === 'absent' || factor.earned === 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
      }}
    >
      <Icon
        size={14}
        strokeWidth={2}
        style={{
          color: isAbsent
            ? 'var(--p7-color-text-muted, #667085)'
            : 'var(--p7-color-success, #027A48)',
          flexShrink: 0,
          opacity: isAbsent ? 0.5 : 1,
        }}
      />

      <span
        style={{
          fontSize: 12,
          fontWeight: 650,
          color: isAbsent
            ? 'var(--p7-color-text-muted, #667085)'
            : 'var(--p7-color-text-primary, #0F1419)',
          lineHeight: 1.3,
        }}
      >
        {factor.label}
      </span>

      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: isAbsent
            ? 'var(--p7-color-text-muted, #667085)'
            : 'var(--p7-color-success, #027A48)',
          whiteSpace: 'nowrap',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {isEarned ? `+${factor.earned}` : `+0`}
      </span>
    </div>
  );
}

export function EvidenceStrengthMeter({
  score,
  maxScore = 100,
  factors,
  compact = false,
  'data-testid': testId,
}: EvidenceStrengthMeterProps) {
  const [showFactors, setShowFactors] = React.useState(!compact);
  const c = scoreColor(score, maxScore);

  if (compact) {
    return (
      <div
        data-testid={testId ?? 'p7-vil-evidence-strength-meter'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 10,
          border: '1px solid var(--p7-color-border, #D7DEE3)',
          background: 'var(--p7-color-surface, #FFFFFF)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p7-color-text-muted, #667085)', flexShrink: 0 }}>
          Доказанность:
        </span>
        <ScoreBar score={score} max={maxScore} />
        <span style={{ fontSize: 13, fontWeight: 900, color: c.text, flexShrink: 0 }}>
          {score}/{maxScore}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={testId ?? 'p7-vil-evidence-strength-meter'}
      style={{
        display: 'grid',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        border: '1px solid var(--p7-color-border, #D7DEE3)',
        background: 'var(--p7-color-surface, #FFFFFF)',
      }}
    >
      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: 'var(--p7-color-text-muted, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Доказанность сделки
            </span>
          </div>
          <ScoreBar score={score} max={maxScore} />
        </div>

        <span style={{ fontSize: 22, fontWeight: 900, color: c.text, flexShrink: 0, lineHeight: 1 }}>
          {score}
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>/{maxScore}</span>
        </span>
      </div>

      {/* Disclaimer */}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', lineHeight: 1.5 }}>
        Технический индекс полноты доказательной базы конкретной сделки, не оценка участников.
      </p>

      {/* Factor breakdown */}
      {factors && factors.length > 0 && (
        <>
          <button
            type='button'
            onClick={() => setShowFactors((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              padding: '3px 10px',
              borderRadius: 8,
              border: '1px solid var(--p7-color-border, #D7DEE3)',
              background: 'transparent',
              color: 'var(--p7-color-text-muted, #667085)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showFactors ? 'Скрыть разбивку' : 'Показать разбивку'}
          </button>

          {showFactors && (
            <div
              style={{
                display: 'grid',
                gap: 0,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--p7-color-surface-muted, #F2F6F0)',
              }}
            >
              {factors.map((factor) => (
                <FactorRow key={factor.id} factor={factor} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
