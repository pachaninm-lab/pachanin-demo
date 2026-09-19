import Link from 'next/link';

export function DecisionReadinessPanel({
  items,
  title = 'Decision readiness',
  subtitle = 'Один взгляд на то, что реально даёт право двигать сделку дальше.',
}: {
  items: { label: string; value: string; state: 'GREEN' | 'AMBER' | 'RED'; href?: string; detail?: string }[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="muted small" style={{ marginTop: 8 }}>{subtitle}</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => {
          const content = (
            <div className="list-row">
              <div>
                <b>{item.label}</b>
                {item.detail ? <div className="muted tiny" style={{ marginTop: 4 }}>{item.detail}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={item.state === 'GREEN' ? 'highlight-green' : item.state === 'AMBER' ? 'highlight-amber' : 'highlight-red'}>{item.value}</div>
              </div>
            </div>
          );
          return item.href ? <Link key={`${item.label}-${item.href}`} href={item.href} className="soft-box linkable">{content}</Link> : <div key={item.label} className="soft-box">{content}</div>;
        })}
      </div>
    </section>
  );
}
