import Link from 'next/link';

type LinkButton = { href: string; label: string };

export function OperationalStatePanel({
  source,
  title,
  detail,
  primary,
  secondary = [],
}: {
  source?: string;
  title: string;
  detail: string;
  primary?: LinkButton;
  secondary?: LinkButton[];
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          <div className="muted small" style={{ marginTop: 6 }}>{detail}</div>
          {source ? <div className="muted tiny" style={{ marginTop: 8 }}>source: {source}</div> : null}
        </div>
        <span className="mini-chip amber">state</span>
      </div>
      {(primary || secondary.length) ? (
        <div className="cta-stack" style={{ marginTop: 14 }}>
          {primary ? <Link href={primary.href} className="primary-link">{primary.label}</Link> : null}
          {secondary.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href} className="secondary-link">{item.label}</Link>)}
        </div>
      ) : null}
    </section>
  );
}
