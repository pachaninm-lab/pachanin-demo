import Link from 'next/link';

type ActionLink = { href: string; label: string; variant?: 'primary' | 'secondary' | 'tertiary' };

export function ActionOutcomePanel({
  title,
  detail,
  status,
  badge,
  primary,
  secondary = [],
  tone,
}: {
  title: string;
  detail: string;
  status?: string;
  badge?: string;
  primary?: ActionLink;
  secondary?: ActionLink[];
  tone?: 'green' | 'amber' | 'red';
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          <div className="muted small" style={{ marginTop: 6 }}>{detail}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {status ? <span className={`mini-chip ${tone || 'green'}`}>{status}</span> : null}
          {badge ? <span className="mini-chip">{badge}</span> : null}
        </div>
      </div>
      {(primary || secondary.length) ? (
        <div className="cta-stack" style={{ marginTop: 14 }}>
          {primary ? <Link href={primary.href} className={primary.variant === 'secondary' ? 'secondary-link' : 'primary-link'}>{primary.label}</Link> : null}
          {secondary.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href} className={item.variant === 'tertiary' ? 'ghost-link' : 'secondary-link'}>{item.label}</Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
