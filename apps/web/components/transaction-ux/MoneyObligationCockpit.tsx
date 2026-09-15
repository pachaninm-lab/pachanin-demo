import type { ReactNode } from 'react';
import { StatusChip, TextStack } from '@pc/design-system-v8';
import styles from './MoneyObligationCockpit.module.css';

export type MoneyStatusTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

export type MoneyFact = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export type MoneyPriority = {
  eyebrow?: string;
  title: string;
  description: string;
  state?: 'waiting' | 'ready' | 'critical';
  amount?: string;
  blocker?: string;
  owner?: string;
  result?: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
};

export type MoneyCockpitLabels = {
  money: string;
  blocker: string;
  owner: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
};

export type MoneyObligationCockpitProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: MoneyStatusTone;
  liveStatus?: ReactNode;
  priority: MoneyPriority;
  facts: MoneyFact[];
  labels?: Partial<MoneyCockpitLabels>;
  children: ReactNode;
  testId?: string;
};

const DEFAULT_LABELS: MoneyCockpitLabels = {
  money: 'Деньги',
  blocker: 'Блокер',
  owner: 'Ответственный',
  result: 'Результат',
  nextAction: 'Следующее безопасное действие',
  prioritySection: 'Главное обязательство',
  factsSection: 'Ключевые факты',
};

export function MoneyObligationCockpit({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  liveStatus,
  priority,
  facts,
  labels,
  children,
  testId,
}: MoneyObligationCockpitProps) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const meta = [
    priority.amount ? { label: copy.money, value: priority.amount } : null,
    priority.blocker ? { label: copy.blocker, value: priority.blocker } : null,
    priority.owner ? { label: copy.owner, value: priority.owner } : null,
    priority.result ? { label: copy.result, value: priority.result } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const priorityClass = priority.state === 'ready'
    ? styles.priorityReady
    : priority.state === 'critical'
      ? styles.priorityCritical
      : '';

  return (
    <main className={styles.root} data-testid={testId} data-money-obligation-cockpit='v8'>
      {liveStatus}
      <header className={styles.header}>
        <TextStack className={styles.heading} spacing='title'>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </TextStack>
        <div className={styles.status}><StatusChip tone={statusTone}>{statusLabel}</StatusChip></div>
      </header>

      <section className={`${styles.priority} ${priorityClass}`} aria-label={copy.prioritySection}>
        <TextStack spacing='title'>
          <span className={styles.priorityEyebrow}>{priority.eyebrow ?? copy.nextAction}</span>
          <h2 className={styles.priorityTitle}>{priority.title}</h2>
          <p className={styles.priorityDescription}>{priority.description}</p>
        </TextStack>
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
        <div className={styles.actions}>{priority.primaryAction}{priority.secondaryAction}</div>
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

      <div className={styles.contentStack}>{children}</div>
    </main>
  );
}

export function MoneyCockpitSection({ id, children }: { id?: string; children: ReactNode }) {
  return <section id={id} className={`${styles.sectionStack} ${styles.sectionAnchor}`}>{children}</section>;
}

export function MoneyBoundary({ children }: { children: ReactNode }) {
  return <div className={styles.boundary}>{children}</div>;
}

export function MoneyQueue({ children }: { children: ReactNode }) {
  return <div className={styles.queue}>{children}</div>;
}

export function MoneyQueueLink({ href, title, detail, status }: { href: string; title: string; detail: string; status?: ReactNode }) {
  return (
    <a className={styles.queueLink} href={href}>
      <span className={styles.queueCopy}><strong>{title}</strong><span>{detail}</span></span>
      {status}
    </a>
  );
}

export const moneyCockpitClasses = {
  primaryLink: styles.primaryLink,
  secondaryLink: styles.secondaryLink,
  sectionStack: styles.sectionStack,
  toolGrid: styles.toolGrid,
  muted: styles.muted,
} as const;
