export function DeadlineProtectionPanel({ items }: { items: Array<{ id: string; title: string; deadline: string; status: 'GREEN' | 'AMBER' | 'RED'; detail?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Deadline protection</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b><span className={item.status === 'GREEN' ? 'highlight-green' : item.status === 'RED' ? 'highlight-red' : 'highlight-amber'}>{item.deadline}</span></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
