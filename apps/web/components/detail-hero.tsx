import Link from 'next/link';
import { ReactNode } from 'react';

type Action = { href: string; label: string; variant?: 'primary' | 'secondary' | 'tertiary' };

export function DetailHero({
  kicker,
  title,
  description,
  chips = [],
  nextStep,
  owner,
  blockers,
  actions = [],
  extra,
  status,
  deadline,
}: {
  kicker?: string;
  title: string;
  description?: string;
  chips?: ReactNode[];
  nextStep?: string;
  owner?: string;
  blockers?: string;
  actions?: Action[];
  extra?: ReactNode;
  status?: string;
  deadline?: string;
}) {
  return (
    <section className="section-card-tight">
      {kicker ? <div className="eyebrow">{kicker}</div> : null}
      <div className="detail-title" style={{ marginTop: 8 }}>{title}</div>
      {description ? <div className="muted" style={{ marginTop: 10 }}>{description}</div> : null}
      {!!chips.length ? <div className="detail-meta" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>{chips.map((chip, index) => <span key={index} className="mini-chip">{chip}</span>)}</div> : null}
      {(owner || nextStep || blockers || status || deadline) ? (
        <div className="section-stack" style={{ marginTop: 14 }}>
          {owner ? <div className="list-row"><span>Owner</span><b>{owner}</b></div> : null}
          {nextStep ? <div className="list-row"><span>Next step</span><b>{nextStep}</b></div> : null}
          {blockers ? <div className="list-row"><span>Blockers</span><b>{blockers}</b></div> : null}
          {status ? <div className="list-row"><span>Status</span><b>{status}</b></div> : null}
          {deadline ? <div className="list-row"><span>Deadline</span><b>{deadline}</b></div> : null}
        </div>
      ) : null}
      {!!actions.length ? (
        <div className="cta-stack" style={{ marginTop: 16 }}>
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={action.variant === 'secondary' ? 'secondary-link' : action.variant === 'tertiary' ? 'ghost-link' : 'primary-link'}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
      {extra ? <div style={{ marginTop: 14 }}>{extra}</div> : null}
    </section>
  );
}
