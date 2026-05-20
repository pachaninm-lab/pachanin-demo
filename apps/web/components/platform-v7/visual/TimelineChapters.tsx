'use client';

import * as React from 'react';
import {
  PlusCircle, DollarSign, Truck, Package, FileText,
  Gavel, Landmark, CheckCircle2, Circle, ChevronDown, ChevronUp,
} from 'lucide-react';

/**
 * TimelineChapters — журнал, сгруппированный по главам сделки.
 *
 * Главы: Создание сделки → Резерв → Рейс → Приёмка → Документы → Спор → Банк → Закрытие
 *
 * На mobile секции сворачиваются (accordion).
 */

export type TimelineChapterId =
  | 'creation'
  | 'reserve'
  | 'trip'
  | 'acceptance'
  | 'documents'
  | 'dispute'
  | 'bank'
  | 'closing';

export interface TimelineEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly actor?: string;
  readonly text: string;
  /** Последствие события */
  readonly impact?: string;
  readonly tone?: 'ok' | 'warn' | 'blocked' | 'money' | 'neutral';
}

export interface TimelineChapter {
  readonly id: TimelineChapterId;
  readonly label: string;
  readonly events: TimelineEvent[];
  readonly status?: 'done' | 'active' | 'upcoming';
}

export interface TimelineChaptersProps {
  readonly chapters: TimelineChapter[];
  readonly defaultExpanded?: TimelineChapterId[];
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const CHAPTER_ICONS: Record<TimelineChapterId, React.ComponentType<{ size: number; strokeWidth?: number }>> = {
  creation:   PlusCircle,
  reserve:    DollarSign,
  trip:       Truck,
  acceptance: Package,
  documents:  FileText,
  dispute:    Gavel,
  bank:       Landmark,
  closing:    CheckCircle2,
};

const CHAPTER_LABELS: Record<TimelineChapterId, string> = {
  creation:   'Создание сделки',
  reserve:    'Резерв',
  trip:       'Рейс',
  acceptance: 'Приёмка',
  documents:  'Документы',
  dispute:    'Спор',
  bank:       'Банк',
  closing:    'Закрытие',
};

const TONE_COLORS = {
  ok:      { color: 'var(--p7-color-success, #027A48)',  dot: 'var(--p7-color-success, #027A48)' },
  warn:    { color: 'var(--p7-color-warning, #B54708)',  dot: 'var(--p7-color-warning, #B54708)' },
  blocked: { color: 'var(--p7-color-danger, #B42318)',   dot: 'var(--p7-color-danger, #B42318)' },
  money:   { color: 'var(--p7-color-money, #155EEF)',    dot: 'var(--p7-color-money, #155EEF)' },
  neutral: { color: 'var(--p7-color-text-secondary, #475569)', dot: 'var(--p7-color-border, #D7DEE3)' },
};

const STATUS_STYLES = {
  done:     { color: 'var(--p7-color-success, #027A48)',  bg: 'var(--p7-color-success-soft, #ECFDF3)' },
  active:   { color: 'var(--p7-color-brand, #0A7A5F)',    bg: 'var(--p7-color-brand-soft, #E5F4EF)' },
  upcoming: { color: 'var(--p7-color-text-muted, #667085)', bg: 'transparent' },
};

function EventRow({ event }: { event: TimelineEvent }) {
  const tone = event.tone ?? 'neutral';
  const c = TONE_COLORS[tone];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '16px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {/* Timeline dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: c.dot,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gap: 2, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: c.color, lineHeight: 1.4 }}>
            {event.text}
          </span>
          {event.timestamp && (
            <span style={{ fontSize: 10, color: 'var(--p7-color-text-muted, #667085)', whiteSpace: 'nowrap' }}>
              {event.timestamp}
            </span>
          )}
        </div>

        {event.actor && (
          <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)' }}>
            {event.actor}
          </span>
        )}

        {event.impact && (
          <span
            style={{
              fontSize: 11,
              color: c.color,
              fontWeight: 600,
              lineHeight: 1.4,
              paddingLeft: 8,
              borderLeft: `2px solid ${c.dot}`,
              opacity: 0.9,
            }}
          >
            → {event.impact}
          </span>
        )}
      </div>
    </div>
  );
}

function ChapterSection({
  chapter,
  defaultOpen,
  compact,
}: {
  chapter: TimelineChapter;
  defaultOpen: boolean;
  compact: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = CHAPTER_ICONS[chapter.id];
  const statusStyle = chapter.status ? STATUS_STYLES[chapter.status] : STATUS_STYLES.upcoming;
  const eventCount = chapter.events.length;

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--p7-color-border, #D7DEE3)',
        background: 'var(--p7-color-surface, #FFFFFF)',
        overflow: 'hidden',
      }}
    >
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: compact ? '8px 12px' : '10px 14px',
          background: open
            ? 'var(--p7-color-surface-muted, #F2F6F0)'
            : 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid var(--p7-color-border, #D7DEE3)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: statusStyle.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={14} strokeWidth={2} style={{ color: statusStyle.color }} />
        </span>

        <span style={{ flex: 1, display: 'grid', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 12 : 13, fontWeight: 850, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.3 }}>
            {chapter.label}
          </span>
          {eventCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)' }}>
              {eventCount} {eventCount === 1 ? 'событие' : eventCount < 5 ? 'события' : 'событий'}
            </span>
          )}
        </span>

        {open ? (
          <ChevronUp size={15} style={{ color: 'var(--p7-color-text-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} style={{ color: 'var(--p7-color-text-muted)', flexShrink: 0 }} />
        )}
      </button>

      {open && eventCount > 0 && (
        <div style={{ padding: compact ? '10px 12px' : '12px 14px', display: 'grid', gap: 0 }}>
          {chapter.events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {open && eventCount === 0 && (
        <div style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: 'var(--p7-color-text-muted, #667085)' }}>
            Событий пока нет
          </span>
        </div>
      )}
    </div>
  );
}

export function TimelineChapters({
  chapters,
  defaultExpanded = ['active' as any],
  compact = false,
  'data-testid': testId,
}: TimelineChaptersProps) {
  if (chapters.length === 0) return null;

  const defaultExpandedSet = new Set<TimelineChapterId>(
    chapters
      .filter((c) => c.status === 'active' || defaultExpanded.includes(c.id as any))
      .map((c) => c.id),
  );

  return (
    <div
      data-testid={testId ?? 'p7-vil-timeline-chapters'}
      style={{ display: 'grid', gap: compact ? 6 : 8 }}
    >
      {chapters.map((chapter) => (
        <ChapterSection
          key={chapter.id}
          chapter={chapter}
          defaultOpen={defaultExpandedSet.has(chapter.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}
