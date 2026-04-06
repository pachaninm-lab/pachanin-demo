'use client';

import Link from 'next/link';

type CopilotAction = { href: string; label: string };

export function ObjectCopilotCard({
  title,
  detail,
  source,
  primary,
  secondary = [],
  prompts = [],
}: {
  title: string;
  detail: string;
  source?: string;
  primary?: CopilotAction;
  secondary?: CopilotAction[];
  prompts?: string[];
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          <div className="muted small" style={{ marginTop: 6 }}>{detail}</div>
          {source ? <div className="muted tiny" style={{ marginTop: 8 }}>source: {source}</div> : null}
        </div>
        <span className="mini-chip blue">copilot</span>
      </div>
      {prompts.length ? (
        <div className="section-stack" style={{ marginTop: 14 }}>
          {prompts.map((prompt) => <div key={prompt} className="soft-box">{prompt}</div>)}
        </div>
      ) : null}
      {(primary || secondary.length) ? (
        <div className="cta-stack" style={{ marginTop: 14 }}>
          {primary ? <Link href={primary.href} className="primary-link">{primary.label}</Link> : null}
          {secondary.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href} className="secondary-link">{item.label}</Link>)}
        </div>
      ) : null}
    </section>
  );
}
