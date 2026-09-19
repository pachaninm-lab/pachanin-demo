export function RoleReadinessBoard({ items }: { items: Array<{ id: string; title: string; ready: boolean; detail?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Role readiness</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b><span className={item.ready ? 'highlight-green' : 'highlight-red'}>{item.ready ? 'READY' : 'WAIT'}</span></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
