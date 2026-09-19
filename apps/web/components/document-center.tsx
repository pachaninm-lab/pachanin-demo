import Link from 'next/link';

export function DocumentCenter({ items }: { items: Array<{ id: string; title: string; status: string; href?: string; detail?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Document center</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b><span className="mini-chip">{item.status}</span></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
            {item.href ? <div style={{ marginTop: 8 }}><Link href={item.href} className="secondary-link">Открыть</Link></div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
