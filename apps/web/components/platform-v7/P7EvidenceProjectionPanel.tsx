'use client';

import { P7ActionLog } from '@/components/platform-v7/P7ActionLog';
import { buildDisputeEvidenceOperationalProjection } from '@/lib/v7r/evidence-operational-projection';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
}

function cell(label: string, value: string | number) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{value}</div>
    </div>
  );
}

export function P7EvidenceProjectionPanel({ disputeId }: { disputeId: string }) {
  const projection = buildDisputeEvidenceOperationalProjection(disputeId);

  return (
    <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Evidence projection</div>
        <div style={{ marginTop: 5, fontSize: 12, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>
          Readiness пакета связан с timeline сделки и журналом оператора. Срез работает только на controlled pilot data layer.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {cell('Evidence score', projection.evidenceScore)}
        {cell('Timeline events', projection.summary.timelineEvents)}
        {cell('Persistence events', projection.summary.persistenceEvents)}
        {cell('Action log', projection.summary.actionLogEntries)}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Projected timeline</div>
        {projection.timeline.map((event, index) => (
          <div key={`${event.ts}-${index}`} style={{ padding: 12, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{event.actor}</span>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{formatTime(event.ts)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>{event.action}</div>
          </div>
        ))}
      </div>

      <P7ActionLog title='Журнал evidence actions' entries={projection.operatorActionLog} maxEntries={4} />
    </section>
  );
}
