import type { ReactNode } from 'react';
import { StatusChip } from '@pc/design-system-v8';
import styles from './OperationalDecisionCockpit.module.css';

export type OperationalTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

export type OperationalFact = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export type OperationalPriority = {
  eyebrow?: string;
  title: string;
  description: string;
  state?: 'active' | 'ready' | 'critical' | 'readonly';
  blocker?: string;
  owner?: string;
  impact?: string;
  result?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
};

export type OperationalCockpitLabels = {
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
};

export type OperationalDecisionCockpitProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: OperationalTone;
  liveStatus?: ReactNode;
  priority: OperationalPriority;
  facts: OperationalFact[];
  boundary?: ReactNode;
  labels?: Partial<OperationalCockpitLabels>;
  children: ReactNode;
  testId?: string;
};

const DEFAULT_LABELS: OperationalCockpitLabels = {
  blocker: 'Блокер',
  owner: 'Ответственный',
  impact: 'Влияние',
  result: 'Результат',
  nextAction: 'Следующее действие',
  prioritySection: 'Главная операционная задача',
  factsSection: 'Ключевые факты',
};

export function OperationalDecisionCockpit({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  liveStatus,
  priority,
  facts,
  boundary,
  labels,
  children,
  testId,
}: OperationalDecisionCockpitProps) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const meta = [
    priority.blocker ? { label: copy.blocker, value: priority.blocker } : null,
    priority.owner ? { label: copy.owner, value: priority.owner } : null,
    priority.impact ? { label: copy.impact, value: priority.impact } : null,
    priority.result ? { label: copy.result, value: priority.result } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const priorityClass = priority.state === 'ready'
    ? styles.priorityReady
    : priority.state === 'critical'
      ? styles.priorityCritical
      : priority.state === 'readonly'
        ? styles.priorityReadonly
        : '';

  return (
    <main className={styles.root} data-testid={testId} data-operational-decision-cockpit='v8'>
      {liveStatus}
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.status}><StatusChip tone={statusTone}>{statusLabel}</StatusChip></div>
      </header>

      <section className={`${styles.priority} ${priorityClass}`} aria-label={copy.prioritySection}>
        <span className={styles.priorityEyebrow}>{priority.eyebrow ?? copy.nextAction}</span>
        <h2 className={styles.priorityTitle}>{priority.title}</h2>
        <p className={styles.priorityDescription}>{priority.description}</p>
        {meta.length > 0 ? (
          <dl className={styles.priorityMeta}>
            {meta.map((item) => (
              <div className={styles.metaItem} key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {priority.primaryAction || priority.secondaryAction ? (
          <div className={styles.actions}>{priority.primaryAction}{priority.secondaryAction}</div>
        ) : null}
      </section>

      <section className={styles.factGrid} aria-label={copy.factsSection}>
        {facts.map((fact) => (
          <article className={styles.fact} key={fact.label}>
            <span className={styles.factLabel}>{fact.label}</span>
            <strong className={styles.factValue}>{fact.value}</strong>
            {fact.hint ? <span className={styles.factHint}>{fact.hint}</span> : null}
          </article>
        ))}
      </section>

      {boundary ? <div className={styles.boundary}>{boundary}</div> : null}
      <div className={styles.contentStack}>{children}</div>
    </main>
  );
}

export function OperationalCockpitSection({ id, children }: { id?: string; children: ReactNode }) {
  return <section id={id} className={`${styles.sectionStack} ${styles.sectionAnchor}`}>{children}</section>;
}

export function OperationalQueue({ children }: { children: ReactNode }) {
  return <div className={styles.queue}>{children}</div>;
}

export function OperationalQueueLink({ href, title, detail, status }: { href: string; title: string; detail: string; status?: ReactNode }) {
  return (
    <a className={styles.queueLink} href={href}>
      <span className={styles.queueCopy}><strong>{title}</strong><span>{detail}</span></span>
      {status}
    </a>
  );
}

export const operationalCockpitClasses = {
  primaryLink: styles.primaryLink,
  secondaryLink: styles.secondaryLink,
  toolGrid: styles.toolGrid,
  muted: styles.muted,
  readOnlyTable: styles.readOnlyTable,
  tableWrap: styles.tableWrap,
} as const;
