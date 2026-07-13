import * as React from 'react';
import { Surface } from './components';
import styles from './templates.module.css';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'information';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const statusClasses: Record<StatusTone, string> = {
  neutral: styles.statusNeutral,
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  danger: styles.statusDanger,
  information: styles.statusInformation,
};

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function StatusBadge({ tone = 'neutral', className, ...props }: StatusBadgeProps) {
  return <span {...props} className={cx(styles.statusBadge, statusClasses[tone], className)} />;
}

export type WorkbenchTemplateProps = {
  density?: 'field' | 'operational' | 'analytical';
  title: React.ReactNode;
  description: React.ReactNode;
  status?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  evidence?: React.ReactNode;
  className?: string;
};

export function WorkbenchTemplate({ title, description, status, primary, secondary, evidence, className }: WorkbenchTemplateProps) {
  return (
    <section className={cx(styles.workbench, className)}>
      <header className={styles.workbenchHeader}>
        <div className={styles.workbenchHeading}>
          <h1 className={styles.workbenchTitle}>{title}</h1>
          <div className={styles.workbenchDescription}>{description}</div>
        </div>
        {status ? <div className={styles.workbenchStatus}>{status}</div> : null}
      </header>
      <div className={styles.workbenchBody}>
        <div className={styles.workbenchPrimary}>{primary}</div>
        {secondary ? <aside className={styles.workbenchSecondary}>{secondary}</aside> : null}
        {evidence ? <div className={styles.workbenchEvidence}>{evidence}</div> : null}
      </div>
    </section>
  );
}

export type NextActionPanelProps = {
  eyebrow?: string;
  title: string;
  description: string;
  blocker?: string;
  deadline?: string;
  moneyImpact?: string;
  action: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export function NextActionPanel({ eyebrow = 'Следующее действие', title, description, blocker, deadline, moneyImpact, action, secondaryAction, className }: NextActionPanelProps) {
  const meta = [
    blocker ? { label: 'Блокер', value: blocker } : null,
    deadline ? { label: 'Срок', value: deadline } : null,
    moneyImpact ? { label: 'Влияние на деньги', value: moneyImpact } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <section className={cx(styles.nextActionPanel, Boolean(blocker) && styles.nextActionBlocked, className)}>
      <span className={styles.nextActionEyebrow}>{eyebrow}</span>
      <h2 className={styles.nextActionTitle}>{title}</h2>
      <p className={styles.nextActionDescription}>{description}</p>
      {meta.length > 0 ? (
        <dl className={styles.nextActionMeta}>
          {meta.map((item) => (
            <div className={styles.nextActionMetaItem} key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={styles.nextActionControls}>{action}{secondaryAction}</div>
    </section>
  );
}

export type KeyFactProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export function KeyFact({ label, value, hint }: KeyFactProps) {
  return (
    <article className={styles.keyFact}>
      <span className={styles.keyFactLabel}>{label}</span>
      <strong className={styles.keyFactValue}>{value}</strong>
      {hint ? <span className={styles.keyFactHint}>{hint}</span> : null}
    </article>
  );
}

export function KeyFactGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx(styles.keyFactGrid, className)}>{children}</div>;
}

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Surface className={styles.emptyState} variant='subtle'>
      <div className={styles.emptyStateCopy}>
        <h2 className={styles.emptyStateTitle}>{title}</h2>
        <p className={styles.emptyStateDescription}>{description}</p>
        {action}
      </div>
    </Surface>
  );
}
