import Link from 'next/link';

export type ModuleHubItem = {
  href: string;
  label: string;
  detail: string;
  icon?: string;
  meta?: string;
  tone?: string;
};

type HubItem = {
  href: string;
  label: string;
  detail: string;
  icon?: string;
  meta?: string;
  tone?: string;
};

export function ModuleHub({ title, subtitle, items = [] }: { title: string; subtitle?: string; items?: HubItem[] }) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          {subtitle ? <div className="muted small" style={{ marginTop: 6 }}>{subtitle}</div> : null}
        </div>
      </div>
      <div className="dashboard-grid-3" style={{ marginTop: 12 }}>
        {items.map((item, index) => (
          <Link key={`${item.href}-${index}`} href={item.href} className="dashboard-card">
            <div className="dashboard-card-title">{item.icon ? `${item.icon} ` : ''}{item.label}</div>
            <div className="dashboard-card-caption" style={{ marginTop: 10 }}>{item.detail}</div>
            {item.meta ? <div className="muted tiny" style={{ marginTop: 10 }}>{item.meta}</div> : null}
          </Link>
        ))}
        {!items.length ? <div className="muted small">Нет связанных модулей.</div> : null}
      </div>
    </section>
  );
}
