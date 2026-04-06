export function RoleHandoffBoard({ items }: { items: Array<{ id: string; from: string; to: string; payload: string; state?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Role handoff</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.from} → {item.to}</b>{item.state ? <span className="mini-chip">{item.state}</span> : null}</div>
            <div className="muted small" style={{ marginTop: 6 }}>{item.payload}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
