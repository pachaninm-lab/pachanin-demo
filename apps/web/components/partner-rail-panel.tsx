import Link from 'next/link';

export function PartnerRailPanel({
  items,
  title = 'Partner rail',
  subtitle = 'Внешний поток должен попадать в наш execution contour, а не жить отдельно.'
}: {
  items: Array<{ id: string; title: string; detail: string; href?: string; state?: string }>;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="muted small" style={{ marginTop: 8 }}>{subtitle}</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row">
              <b>{item.title}</b>
              {item.state ? <span className="mini-chip">{item.state}</span> : null}
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div>
            {item.href ? <div style={{ marginTop: 8 }}><Link href={item.href} className="secondary-link">Открыть</Link></div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
