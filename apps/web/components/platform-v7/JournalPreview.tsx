import { getJournalPreviewEntries, type JournalPreviewRole } from '@/lib/platform-v7/journal-preview';
import type { PlatformActionStatus } from '@/lib/platform-v7/action-log';

interface Props {
  role: JournalPreviewRole;
  maxEntries?: number;
}

const STATUS_LABEL: Record<PlatformActionStatus, string> = {
  success: 'выполнено',
  error: 'остановлено',
  started: 'в работе',
};

const STATUS_COLOR: Record<PlatformActionStatus, string> = {
  success: '#0A7A5F',
  error: '#B91C1C',
  started: '#B45309',
};

const STATUS_BG: Record<PlatformActionStatus, string> = {
  success: 'rgba(10,122,95,0.07)',
  error: 'rgba(220,38,38,0.07)',
  started: 'rgba(217,119,6,0.07)',
};

const STATUS_BORDER: Record<PlatformActionStatus, string> = {
  success: 'rgba(10,122,95,0.18)',
  error: 'rgba(220,38,38,0.18)',
  started: 'rgba(217,119,6,0.18)',
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function JournalPreview({ role, maxEntries = 3 }: Props) {
  const entries = getJournalPreviewEntries(role, maxEntries);

  return (
    <section
      data-testid="journal-preview"
      data-role={role}
      style={shell}
    >
      <div style={micro}>журнал событий · пилотный контур</div>

      {entries.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 13 }}>События пока не зафиксированы.</div>
      ) : (
        <div style={{ display: 'grid', gap: 7 }}>
          {entries.map((entry) => {
            const color = STATUS_COLOR[entry.status];
            const bg = STATUS_BG[entry.status];
            const border = STATUS_BORDER[entry.status];

            return (
              <div
                key={entry.id}
                data-testid="journal-preview-entry"
                data-status={entry.status}
                data-object={entry.objectId}
                style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: 11, display: 'grid', gap: 5 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: '#fff', border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 900 }}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>{formatTs(entry.at)}</span>
                </div>
                <div style={{ color: '#0F1419', fontSize: 13, fontWeight: 900, lineHeight: 1.4 }}>
                  {entry.objectId}
                </div>
                <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.45 }}>
                  {entry.message}
                </div>
                {entry.error ? (
                  <div style={{ color: '#B91C1C', fontSize: 12, lineHeight: 1.4 }}>
                    причина остановки: {entry.error}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const shell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;
