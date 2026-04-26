'use client';

import type { PlatformActionLogEntry, PlatformActionStatus } from '@/lib/platform-v7/action-log';
import { getPlatformV7ToneTokens, PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export interface P7ActionLogProps {
  readonly title: string;
  readonly entries: readonly PlatformActionLogEntry[];
  readonly emptyLabel?: string;
  readonly maxEntries?: number;
}

function actionStatusTone(status: PlatformActionStatus): { tone: PlatformV7Tone; label: string } {
  if (status === 'success') return { tone: 'success', label: 'Успешно' };
  if (status === 'error') return { tone: 'danger', label: 'Ошибка' };
  return { tone: 'warning', label: 'Выполняется' };
}

function formatActionLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
}

export function P7ActionLog({ title, entries, emptyLabel = 'Действий пока нет.', maxEntries }: P7ActionLogProps) {
  const visibleEntries = typeof maxEntries === 'number' ? entries.slice(0, maxEntries) : entries;

  return (
    <section
      style={{
        background: PLATFORM_V7_TOKENS.color.surface,
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.lg + 2,
        padding: PLATFORM_V7_TOKENS.spacing.md + 2,
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.sm,
      }}
    >
      <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.h3.size + 2, fontWeight: 800, color: PLATFORM_V7_TOKENS.color.text }}>
        {title}
      </div>

      {visibleEntries.length ? visibleEntries.map((entry) => {
        const status = actionStatusTone(entry.status);
        const tone = getPlatformV7ToneTokens(status.tone);

        return (
          <div
            key={entry.id}
            data-status={entry.status}
            style={{
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              borderRadius: PLATFORM_V7_TOKENS.radius.md + 2,
              padding: PLATFORM_V7_TOKENS.spacing.sm,
              display: 'grid',
              gap: PLATFORM_V7_TOKENS.spacing.xs - 2,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.xs + 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', borderRadius: PLATFORM_V7_TOKENS.radius.pill, padding: '4px 8px', background: PLATFORM_V7_TOKENS.color.surface, color: tone.fg, fontSize: 11, fontWeight: 800 }}>
                  {status.label}
                </span>
                <span style={{ color: PLATFORM_V7_TOKENS.color.text, fontSize: 13, fontWeight: 800 }}>{entry.action}</span>
              </div>
              <span style={{ color: PLATFORM_V7_TOKENS.color.textSubtle, fontSize: 11 }}>{formatActionLogTime(entry.at)}</span>
            </div>
            <div style={{ color: entry.status === 'error' ? PLATFORM_V7_TOKENS.color.danger : PLATFORM_V7_TOKENS.color.textMuted, fontSize: 13, lineHeight: 1.5 }}>
              {entry.message}
            </div>
            {entry.error ? (
              <div style={{ color: PLATFORM_V7_TOKENS.color.danger, fontSize: 12, lineHeight: 1.5 }}>
                Ошибка: {entry.error}
              </div>
            ) : null}
          </div>
        );
      }) : <div style={{ color: PLATFORM_V7_TOKENS.color.textSubtle, fontSize: 13 }}>{emptyLabel}</div>}
    </section>
  );
}
