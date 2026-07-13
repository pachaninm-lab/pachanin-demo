import type { ReactNode } from 'react';
import { StatusChip } from '@pc/design-system-v8';
import styles from './ControlRoleCockpit.module.css';

export type ControlStatusTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';
export type ControlPriorityState = 'information' | 'warning' | 'critical' | 'success';

export type ControlFact = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export type ControlPriority = {
  eyebrow?: string;
  title: string;
  description: string;
  state?: ControlPriorityState;
  impact?: string;
  blocker?: string;
  owner?: string;
  deadline?: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
};

export type ControlRoleCockpitProps = {
  kind: 'dispatch' | 'decision' | 'executive';
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: ControlStatusTone;
  liveStatus?: ReactNode;
  priority: ControlPriority;
  facts: ControlFact[];
  children: ReactNode;
  testId?: string;
};

export function ControlRoleCockpit({
  kind,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  liveStatus,
  priority,
  facts,
  children,
  testId,
}: ControlRoleCockpitProps) {
  const meta = [
    priority.impact ? { label: 'Влияние', value: priority.impact } : null,
    priority.blocker ? { label: 'Блокер', value: priority.blocker } : null,
    priority.owner ? { label: 'Ответственный', value: priority.owner } : null,
    priority.deadline ? { label: 'Срок', value: priority.deadline } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const priorityClass = priority.state === 'warning'
    ? styles.priorityWarning
    : priority.state === 'critical'
      ? styles.priorityCritical
      : priority.state === 'success'
        ? styles.prioritySuccess
        : '';

  return (
    <main className={styles.root} data-testid={testId} data-control-role-cockpit={kind}>
      {liveStatus}
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.status}><StatusChip tone={statusTone}>{statusLabel}</StatusChip></div>
      </header>

      <section className={`${styles.priority} ${priorityClass}`} aria-label='Главная управленческая задача'>
        <span className={styles.priorityEyebrow}>{priority.eyebrow ?? 'Главный приоритет'}</span>
        <h2 className={styles.priorityTitle}>{priority.title}</h2>
        <p className={styles.priorityDescription}>{priority.description}</p>
        {meta.length > 0 ? (
          <dl className={styles.metaGrid}>
            {meta.map((item) => (
              <div className={styles.metaItem} key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className={styles.actions}>{priority.primaryAction}{priority.secondaryAction}</div>
      </section>

      <section className={styles.factGrid} aria-label='Ключевые факты'>
        {facts.map((fact) => (
          <article className={styles.fact} key={fact.label}>
            <span className={styles.factLabel}>{fact.label}</span>
            <strong className={styles.factValue}>{fact.value}</strong>
            {fact.hint ? <span className={styles.factHint}>{fact.hint}</span> : null}
          </article>
        ))}
      </section>

      <div className={styles.content}>{children}</div>
    </main>
  );
}

export function ControlCockpitSection({ id, children }: { id?: string; children: ReactNode }) {
  return <section id={id} className={`${styles.section} ${styles.sectionAnchor}`}>{children}</section>;
}

export function ControlBoundary({ children }: { children: ReactNode }) {
  return <div className={styles.boundary}>{children}</div>;
}

export function ControlQueue({ children }: { children: ReactNode }) {
  return <div className={styles.queue}>{children}</div>;
}

export function ControlQueueLink({ href, title, detail, status }: { href: string; title: string; detail: string; status?: ReactNode }) {
  return (
    <a className={styles.queueLink} href={href}>
      <span className={styles.queueCopy}><strong>{title}</strong><span>{detail}</span></span>
      {status}
    </a>
  );
}

export function ControlTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const controlCockpitClasses = {
  primaryLink: styles.primaryLink,
  secondaryLink: styles.secondaryLink,
  section: styles.section,
  stack: styles.stack,
  toolGrid: styles.toolGrid,
  muted: styles.muted,
} as const;
