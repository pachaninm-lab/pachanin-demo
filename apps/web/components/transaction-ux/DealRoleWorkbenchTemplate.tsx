import type { ReactNode } from 'react';
import { StatusChip, Surface } from '@pc/design-system-v8';
import styles from './DealRoleWorkbenchTemplate.module.css';

export type DealRoleTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

export type DealRoleWorkbenchTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: DealRoleTone;
  liveStatus?: ReactNode;
  primary: ReactNode;
  context?: ReactNode;
  details?: ReactNode;
  testId?: string;
};

export function DealRoleWorkbenchTemplate({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  liveStatus,
  primary,
  context,
  details,
  testId,
}: DealRoleWorkbenchTemplateProps) {
  return (
    <div className={styles.root} data-testid={testId} data-density='comfortable'>
      {liveStatus}
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
      </header>
      <section className={styles.workArea} aria-label='Рабочая область роли'>
        <div className={styles.primary}>{primary}</div>
        {context ? <aside className={styles.context} aria-label='Контекст сделки'><Surface>{context}</Surface></aside> : null}
      </section>
      {details ? <section className={styles.details} aria-label='Детали и доказательства'>{details}</section> : null}
    </div>
  );
}
