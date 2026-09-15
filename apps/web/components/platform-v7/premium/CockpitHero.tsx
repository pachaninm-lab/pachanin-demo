import type { ReactNode } from 'react';
import { TextStack } from '@pc/design-system-v8';
import styles from './CockpitHero.module.css';

export function CockpitHero({
  eyebrow,
  title,
  accent,
  lead,
  aside,
  children,
  className,
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
  /** extra class appended to the hero root (keeps page-specific responsive rules) */
  className?: string;
}) {
  const rootClassName = ['pc-prem-hero', styles.root, className].filter(Boolean).join(' ');

  return (
    <section className={rootClassName}>
      <div className={styles.layout}>
        <TextStack className={styles.copy} spacing='title'>
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
        </TextStack>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
