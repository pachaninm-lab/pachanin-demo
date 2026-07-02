'use client';

import { useState } from 'react';
import type { DealEvent, DealEventType } from '@/lib/platform-v7/deal-event-chain-client';

const EVENT_LABELS: Record<DealEventType, string> = {
  DEAL_CREATED: 'Сделка создана',
  DEAL_SIGNED: 'Сделка подписана',
  PAYMENT_RESERVED: 'Оплата зарезервирована',
  LOADING_STARTED: 'Погрузка начата',
  IN_TRANSIT: 'В пути',
  ARRIVED: 'Прибыл на элеватор',
  QUALITY_CHECK_STARTED: 'Начат контроль качества',
  QUALITY_ACCEPTED: 'Качество принято',
  QUALITY_DISPUTED: 'Качество оспорено',
  PAYMENT_RELEASED: 'Оплата выпущена',
  SETTLEMENT_DONE: 'Расчёт завершён',
  DEAL_CLOSED: 'Сделка закрыта',
  DEAL_CANCELLED: 'Сделка отменена',
  DISPUTE_OPENED: 'Открыт спор',
  ARBITRATION_STARTED: 'Арбитраж начат',
  ARBITRATION_DECIDED: 'Решение арбитража',
};

const EVENT_COLOR: Partial<Record<DealEventType, string>> = {
  DEAL_CREATED: 'var(--status-info-text)',
  DEAL_SIGNED: 'var(--status-signed-text)',
  PAYMENT_RESERVED: 'var(--status-reserved-text)',
  PAYMENT_RELEASED: 'var(--status-paid-text)',
  SETTLEMENT_DONE: 'var(--status-paid-text)',
  DEAL_CLOSED: 'var(--status-closed-text)',
  DEAL_CANCELLED: 'var(--status-closed-text)',
  DISPUTE_OPENED: 'var(--status-dispute-text)',
  ARBITRATION_STARTED: 'var(--status-dispute-text)',
  ARBITRATION_DECIDED: 'var(--status-warning-text)',
};

interface Props {
  events: DealEvent[];
  showHashes?: boolean;
}

export function DealEventHistoryPanel({ events, showHashes = false }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Событий нет</p>
        <p className="empty-state__description">История изменений сделки появится после первых действий.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
      {events.map((ev, i) => {
        const color = EVENT_COLOR[ev.eventType] ?? 'var(--pc-text-secondary)';
        const isLast = i === events.length - 1;
        const isOpen = expanded === ev.id;
        const date = new Date(ev.occurredAt);
        const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            {/* Timeline line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1.25rem', flexShrink: 0 }}>
              <div style={{
                width: '0.625rem', height: '0.625rem', borderRadius: '50%',
                background: color, border: '2px solid var(--p7-color-background)',
                marginTop: '0.875rem', flexShrink: 0, zIndex: 1,
              }} />
              {!isLast && (
                <div style={{
                  flex: 1, width: '1px', background: 'var(--p7-color-border)',
                  minHeight: '1.5rem',
                }} />
              )}
            </div>

            {/* Event card */}
            <div
              style={{
                flex: 1, padding: '0.5rem 0.75rem', marginBottom: '0.25rem',
                borderRadius: '6px', cursor: 'pointer',
                background: isOpen ? 'var(--p7-color-surface-muted)' : 'transparent',
                transition: 'background 120ms ease',
              }}
              onClick={() => setExpanded(isOpen ? null : ev.id)}
              role="button"
              aria-expanded={isOpen}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setExpanded(isOpen ? null : ev.id)}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
                  {dateStr} · {timeStr}
                </span>
                {ev.payload.actorRole && (
                  <span style={{
                    fontSize: 'var(--text-xs)', padding: '0 0.375rem', borderRadius: '4px',
                    background: 'var(--p7-color-surface-strong)', color: 'var(--pc-text-muted)',
                  }}>
                    {ev.payload.actorRole}
                  </span>
                )}
              </div>

              {isOpen && (
                <div style={{ marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--pc-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {ev.payload.actorId && (
                    <span>Исполнитель: <code className="mono">{ev.payload.actorId}</code></span>
                  )}
                  {ev.payload.newStatus && (
                    <span>Новый статус: <strong>{ev.payload.newStatus}</strong></span>
                  )}
                  {ev.payload.meta && Object.keys(ev.payload.meta).length > 0 && (
                    <pre style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(ev.payload.meta, null, 2)}
                    </pre>
                  )}
                  {showHashes && (
                    <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                      <span className="mono" style={{ color: 'var(--pc-text-muted)', fontSize: '10px' }}>hash: {ev.hash}</span>
                      <span className="mono" style={{ color: 'var(--pc-text-muted)', fontSize: '10px' }}>prev: {ev.prevHash}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
