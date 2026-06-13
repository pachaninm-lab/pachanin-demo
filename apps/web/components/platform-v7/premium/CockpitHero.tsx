import type { ReactNode } from 'react';

export function CockpitHero({
  eyebrow,
  title,
  accent,
  lead,
  aside,
  children,
}: {
  eyebrow?: ReactNode;
  /** leading part of the headline rendered in the primary text colour */
  title: ReactNode;
  /** trailing part of the headline rendered in the brand accent colour */
  accent?: ReactNode;
  lead?: ReactNode;
  /** optional element shown to the right of the headline (e.g. a blocker card) */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className='pc-prem-hero'>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 9 }}>
          {eyebrow ? <span className='pc-prem-hero__eyebrow'>{eyebrow}</span> : null}
          <h1 className='pc-prem-hero__title'>
            {title}
            {accent ? (
              <>
                {' '}
                <span className='pc-prem-hero__accent'>{accent}</span>
              </>
            ) : null}
          </h1>
          {lead ? <p className='pc-prem-hero__lead'>{lead}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
