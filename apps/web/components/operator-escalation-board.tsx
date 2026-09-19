import Link from 'next/link';

export function OperatorEscalationBoard({ items, title = 'Escalation board' }: { items: any[]; title?: string }) {
  return (
    <section className="section-card">
      <div className="dashboard-section-title">{title}</div>
      <div className="section-stack" style={{ marginTop: 16 }}>
        {(items || []).map((item, index) => (
          <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.title || item.id || `case ${index + 1}`}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{item.detail || item.reason || '—'}</div>
              <div className="muted tiny" style={{ marginTop: 4 }}>owner {item.owner || '—'} · next {item.nextAction || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="mini-chip">{item.severity || 'focus'}</span>
              {item.href ? <div style={{ marginTop: 8 }}><Link href={item.href} className="secondary-link">Открыть</Link></div> : null}
            </div>
          </div>
        ))}
        {!(items || []).length ? <div className="muted small">Эскалаций сейчас нет.</div> : null}
      </div>
    </section>
  );
}
