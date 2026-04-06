import Link from 'next/link';

type Stage = { title: string; detail: string; state?: string; href?: string };
type Outcome = { href: string; label: string; detail: string; meta?: string };

export function OperationBlueprint({
  title,
  subtitle,
  stages = [],
  outcomes = [],
  rules = [],
}: {
  title: string;
  subtitle?: string;
  stages?: Stage[];
  outcomes?: Outcome[];
  rules?: string[];
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          {subtitle ? <div className="muted small" style={{ marginTop: 6 }}>{subtitle}</div> : null}
        </div>
      </div>

      {!!stages.length && (
        <div className="section-stack" style={{ marginTop: 12 }}>
          {stages.map((stage, index) => (
            <div key={`${stage.title}-${index}`} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{stage.title}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{stage.detail}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="mini-chip">{stage.state || 'pending'}</span>
                {stage.href ? <div style={{ marginTop: 8 }}><Link href={stage.href} className="secondary-link">Открыть</Link></div> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {!!outcomes.length && (
        <div className="section-stack" style={{ marginTop: 16 }}>
          <div className="section-title">Outcomes</div>
          {outcomes.map((item, index) => (
            <Link key={`${item.href}-${index}`} href={item.href} className="list-row linkable" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{item.detail}</div>
              </div>
              <span className="mini-chip">{item.meta || 'next'}</span>
            </Link>
          ))}
        </div>
      )}

      {!!rules.length && (
        <div className="section-stack" style={{ marginTop: 16 }}>
          <div className="section-title">Rules</div>
          {rules.map((rule, index) => <div key={`${rule}-${index}`} className="soft-box">{rule}</div>)}
        </div>
      )}
    </section>
  );
}
