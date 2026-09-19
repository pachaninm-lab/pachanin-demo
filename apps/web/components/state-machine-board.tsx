export function StateMachineBoard({ items }: { items: Array<{ id: string; title: string; state: string; detail?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">State machine board</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b><span className="mini-chip">{item.state}</span></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
