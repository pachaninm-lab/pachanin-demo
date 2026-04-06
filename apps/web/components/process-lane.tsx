import Link from 'next/link';

export function ProcessLane({ items }: { items: Array<{ id: string; title: string; detail?: string; href?: string; state?: string }> }) {
  return (
    <section className="card">
      <div className="section-title">Process lane</div>
      <div className="workflow-steps" style={{ marginTop: 12 }}>
        {items.map((item) => {
          const content = (
            <div className={`workflow-step ${String(item.state || '').toLowerCase()}`}>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              {item.detail ? <div className="tiny muted" style={{ marginTop: 6 }}>{item.detail}</div> : null}
            </div>
          );
          return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}
