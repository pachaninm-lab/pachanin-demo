import Link from 'next/link';

export function ExecutionReadinessPanel({ data }: { data: any }) {
  const lanes = data?.lanes || [];
  const bottlenecks = data?.bottlenecks || [];

  return (
    <section className="section-card">
      <div className="dashboard-section-title">Execution readiness</div>
      <div className="dashboard-grid-4" style={{ marginTop: 16 }}>
        <div className="dashboard-card"><div className="dashboard-card-title">Rail score</div><div className="dashboard-card-value">{data?.summary?.railScore ?? '—'}</div><div className="dashboard-card-caption">Итоговая зрелость rail.</div></div>
        <div className="dashboard-card"><div className="dashboard-card-title">Blocked deals</div><div className="dashboard-card-value">{data?.summary?.blockedDeals ?? '—'}</div><div className="dashboard-card-caption">Сделки, где следующий шаг ещё опасен.</div></div>
        <div className="dashboard-card"><div className="dashboard-card-title">Active disputes</div><div className="dashboard-card-value">{data?.summary?.activeDisputes ?? '—'}</div><div className="dashboard-card-caption">Спорный хвост по execution.</div></div>
        <div className="dashboard-card"><div className="dashboard-card-title">Trusted buyers</div><div className="dashboard-card-value">{data?.summary?.trustedBuyers ?? '—'}</div><div className="dashboard-card-caption">Доверенный buyer-layer.</div></div>
      </div>

      {!!lanes.length && (
        <div className="section-stack" style={{ marginTop: 18 }}>
          {lanes.map((lane: any, index: number) => (
            <div key={lane.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{lane.title || lane.id || `lane ${index + 1}`}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{lane.detail || lane.reason || '—'}</div>
              </div>
              <span className="mini-chip">{lane.status || lane.score || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {!!bottlenecks.length && (
        <div className="section-stack" style={{ marginTop: 18 }}>
          <div className="section-title">Bottlenecks</div>
          {bottlenecks.map((item: any, index: number) => (
            <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.title || item.id || `bottleneck ${index + 1}`}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{item.detail || item.reason || '—'}</div>
              </div>
              <span className="mini-chip">{item.severity || 'focus'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cta-stack" style={{ marginTop: 16 }}>
        <Link href="/pilot-mode" className="secondary-link">Pilot mode</Link>
        <Link href="/operator-cockpit" className="secondary-link">Operator cockpit</Link>
      </div>
    </section>
  );
}
