export function ReleaseReadinessCard({
  items,
  title = 'Release readiness'
}: {
  items: Array<{ label: string; ready: boolean; detail?: string }>;
  title?: string;
}) {
  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.label} className="soft-box">
            <div className="list-row"><b>{item.label}</b><span className={item.ready ? 'highlight-green' : 'highlight-red'}>{item.ready ? 'READY' : 'WAIT'}</span></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
