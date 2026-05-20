'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * TimelineWithImpact — компактный timeline с последствиями событий.
 *
 * Не так:  "Акт подписан"
 * А так:   "Акт приёмки подписан → открыт путь к банковскому основанию"
 *
 * Использование:
 *   <TimelineWithImpact
 *     events={[
 *       { id: '1', text: 'Акт приёмки подписан', impact: 'открыт путь к банковскому основанию', tone: 'ok', ts: '14:30' },
 *       { id: '2', text: 'СДИЗ закрыт', impact: 'снят блокер отгрузки', tone: 'ok', ts: '14:45' },
 *       { id: '3', text: 'Лаборатория выявила расхождение', impact: 'создано удержание 624 тыс ₽', tone: 'blocked', ts: '15:10' },
 *     ]}
 *   />
 */

export interface TimelineImpactEvent {
  readonly id: string;
  readonly text: string;
  readonly impact?: string;
  readonly actor?: string;
  readonly ts?: string;
  readonly tone?: 'ok' | 'warn' | 'blocked' | 'money' | 'neutral';
}

export interface TimelineWithImpactProps {
  readonly events: TimelineImpactEvent[];
  readonly maxItems?: number;
  readonly showAll?: boolean;
  readonly compact?: boolean;
  readonly 'data-testid'?: string;
}

const TONE_COLORS = {
  ok:      { dot: 'var(--p7-color-success, #027A48)',  text: 'var(--p7-color-success, #027A48)',  impact: 'var(--p7-color-success, #027A48)' },
  warn:    { dot: 'var(--p7-color-warning, #B54708)',  text: 'var(--p7-color-warning, #B54708)',  impact: 'var(--p7-color-warning, #B54708)' },
  blocked: { dot: 'var(--p7-color-danger, #B42318)',   text: 'var(--p7-color-danger, #B42318)',   impact: 'var(--p7-color-danger, #B42318)' },
  money:   { dot: 'var(--p7-color-money, #155EEF)',    text: 'var(--p7-color-money, #155EEF)',    impact: 'var(--p7-color-money, #155EEF)' },
  neutral: { dot: 'var(--p7-color-border, #D7DEE3)',   text: 'var(--p7-color-text-primary, #0F1419)', impact: 'var(--p7-color-text-secondary, #475569)' },
};

function ImpactEvent({ event, compact }: { event: TimelineImpactEvent; compact: boolean }) {
  const tone = event.tone ?? 'neutral';
  const c = TONE_COLORS[tone];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '10px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {/* Timeline dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: c.dot,
          flexShrink: 0,
          marginTop: 3,
        }}
      />

      {/* Content */}
      <div style={{ display: 'grid', gap: 3, paddingBottom: compact ? 8 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              color: 'var(--p7-color-text-primary, #0F1419)',
              lineHeight: 1.4,
            }}
          >
            {event.text}
          </span>
          {event.ts && (
            <span style={{ fontSize: 10, color: 'var(--p7-color-text-muted, #667085)', whiteSpace: 'nowrap' }}>
              {event.ts}
            </span>
          )}
        </div>

        {event.actor && !compact && (
          <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)', lineHeight: 1.3 }}>
            {event.actor}
          </span>
        )}

        {event.impact && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 5,
              paddingLeft: 8,
              borderLeft: `2px solid ${c.dot}`,
            }}
          >
            <ArrowRight
              size={11}
              strokeWidth={2.2}
              style={{
                color: c.impact,
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <span
              style={{
                fontSize: compact ? 11 : 12,
                color: c.impact,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {event.impact}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TimelineWithImpact({
  events,
  maxItems = 5,
  showAll = false,
  compact = false,
  'data-testid': testId,
}: TimelineWithImpactProps) {
  const [expanded, setExpanded] = React.useState(showAll);
  const displayedEvents = expanded ? events : events.slice(0, maxItems);
  const hasMore = events.length > maxItems;

  if (events.length === 0) return null;

  return (
    <div
      data-testid={testId ?? 'p7-vil-timeline-with-impact'}
      style={{ display: 'grid', gap: 0 }}
    >
      {/* Timeline line container */}
      <div style={{ position: 'relative' }}>
        {/* Vertical connector line */}
        {displayedEvents.length > 1 && (
          <div
            aria-hidden='true'
            style={{
              position: 'absolute',
              left: 4,
              top: 6,
              bottom: 10,
              width: 1,
              background: 'var(--p7-color-border, #D7DEE3)',
            }}
          />
        )}

        {displayedEvents.map((event) => (
          <ImpactEvent key={event.id} event={event} compact={compact} />
        ))}
      </div>

      {!expanded && hasMore && (
        <button
          type='button'
          onClick={() => setExpanded(true)}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            marginLeft: 20,
            borderRadius: 8,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'transparent',
            color: 'var(--p7-color-text-muted, #667085)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ещё {events.length - maxItems} событий
        </button>
      )}

      {expanded && hasMore && (
        <button
          type='button'
          onClick={() => setExpanded(false)}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            marginLeft: 20,
            borderRadius: 8,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'transparent',
            color: 'var(--p7-color-text-muted, #667085)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Свернуть
        </button>
      )}
    </div>
  );
}
