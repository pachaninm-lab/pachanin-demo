import type { ReactNode } from 'react';
import { StatusChip, Surface } from '@pc/design-system-v8';
import styles from './FieldTaskTemplate.module.css';

export type FieldStatusTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

export type FieldTaskTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: FieldStatusTone;
  primary: ReactNode;
  context?: ReactNode;
  evidence?: ReactNode;
  liveStatus?: ReactNode;
  testId?: string;
};

export function FieldTaskTemplate({ eyebrow, title, description, statusLabel, statusTone = 'neutral', primary, context, evidence, liveStatus, testId }: FieldTaskTemplateProps) {
  return (
    <div className={styles.root} data-testid={testId} data-density='field'>
      {liveStatus}
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
      </header>
      <section className={styles.workArea} aria-label='Рабочая область'>
        <div className={styles.primary}>{primary}</div>
        {context ? <aside className={styles.context} aria-label='Контекст задачи'><Surface>{context}</Surface></aside> : null}
      </section>
      {evidence ? <section className={styles.evidence} aria-label='Доказательства'>{evidence}</section> : null}
    </div>
  );
}

export type IntakeWorkbenchTemplateProps = FieldTaskTemplateProps & { intakeSummary: ReactNode };

export function IntakeWorkbenchTemplate({ intakeSummary, context, ...props }: IntakeWorkbenchTemplateProps) {
  return <FieldTaskTemplate {...props} context={<div className={styles.contextStack}><section aria-label='Сводка приёмки'>{intakeSummary}</section>{context}</div>} />;
}

export function KeyFactGrid({ children }: { children: ReactNode }) { return <dl className={styles.factGrid}>{children}</dl>; }

export function KeyFact({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return <div className={styles.fact}><dt>{label}</dt><dd>{value}</dd>{hint ? <small>{hint}</small> : null}</div>;
}
