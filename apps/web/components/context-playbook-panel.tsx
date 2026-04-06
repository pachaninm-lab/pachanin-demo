export function ContextPlaybookPanel({ items }: { items: Array<{ id: string; title: string; detail: string; owner?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Context playbook</div>
      <div className="muted small" style={{ marginTop: 8 }}>Один экран для сценариев реакции: что делать, кто владелец и в какой контур идти дальше.</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <b>{item.title}</b>
            <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div>
            {item.owner ? <div className="muted tiny" style={{ marginTop: 6 }}>owner {item.owner}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
