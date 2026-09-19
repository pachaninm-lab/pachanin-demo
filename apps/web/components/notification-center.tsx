export function NotificationCenter({ items }: { items: Array<{ id: string; title: string; detail?: string; unread?: boolean }> }) {
  return (
    <section className="card">
      <div className="section-title">Notification center</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b>{item.unread ? <span className="highlight-amber">new</span> : null}</div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
