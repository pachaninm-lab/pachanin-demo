import Link from 'next/link';

export function OperatorCaseCenterPanel({ rows }: { rows: any[] }) {
  return (
    <section className="section-card">
      <div className="dashboard-section-title">Operator case center</div>
      <div className="section-stack" style={{ marginTop: 16 }}>
        {(rows || []).map((row, index) => (
          <div key={row.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{row.title || row.id || `case ${index + 1}`}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{row.detail || row.reason || '—'}</div>
              <div className="muted tiny" style={{ marginTop: 4 }}>owner {row.owner || '—'} · lane {row.lane || row.type || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="mini-chip">{row.status || row.priority || 'open'}</span>
              {row.href ? <div style={{ marginTop: 8 }}><Link href={row.href} className="secondary-link">Открыть</Link></div> : null}
            </div>
          </div>
        ))}
        {!(rows || []).length ? <div className="muted small">Открытых case rows нет.</div> : null}
      </div>
    </section>
  );
}
