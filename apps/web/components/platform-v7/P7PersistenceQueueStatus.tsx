import { buildStableV7rPersistenceSummary } from '@/lib/v7r/persistence-queue';

const metricLabels = [
  { key: 'totalLedgerEntries', label: 'Ledger entries' },
  { key: 'totalQueueItems', label: 'Queue items' },
  { key: 'manualReviewItems', label: 'Manual review' },
  { key: 'timelineEvents', label: 'Timeline events' },
] as const;

export function P7PersistenceQueueStatus() {
  const summary = buildStableV7rPersistenceSummary();

  return (
    <section
      data-testid="persistence-queue-status"
      style={{
        background: '#fff',
        border: '1px solid #E4E6EA',
        borderRadius: 18,
        padding: 18,
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 900, color: '#0F1419' }}>Persistence queue status</div>
          <div style={{ marginTop: 8, maxWidth: 840, fontSize: 13, lineHeight: 1.65, color: '#5B6576' }}>
            E8 foundation: единая append-only очередь для bank runtime, reconciliation и deal timeline projection. Это controlled pilot data layer, не production-БД и не live-интеграция банка.
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,20,25,0.04)', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 900 }}>
          Append-only · idempotent
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {metricLabels.map((metric) => (
          <div key={metric.key} style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{metric.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{summary[metric.key]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>Manual reconciliation queue</div>
        {summary.manualQueue.length === 0 ? (
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', fontSize: 12, lineHeight: 1.5, color: '#0A7A5F', fontWeight: 800 }}>
            Очередь ручной сверки пустая.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {summary.manualQueue.map((item) => (
              <article
                key={item.id}
                data-testid="manual-reconciliation-item"
                style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.4, fontWeight: 900, color: '#0F1419' }}>{item.dealId}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', fontSize: 11, fontWeight: 900 }}>
                    {item.reason}
                  </span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.5, color: '#475569', wordBreak: 'break-all' }}>{item.idempotencyKey}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
