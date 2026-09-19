import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusChip } from '@pc/design-system-v8';
import {
  OperationalDecisionCockpit,
  type OperationalDecisionCockpitProps,
  type OperationalTone,
} from './OperationalDecisionCockpit';
import styles from './PhysicalExecutionCockpit.module.css';

export type PhysicalExecutionPhaseId = 'logistics' | 'acceptance' | 'documents' | 'bank';
export type PhysicalExecutionPhaseState = 'complete' | 'current' | 'available' | 'blocked';

export type PhysicalExecutionPhase = {
  id: PhysicalExecutionPhaseId;
  href: string;
  label: string;
  description: string;
  state: PhysicalExecutionPhaseState;
  stateLabel: string;
};

export type PhysicalExecutionCockpitProps = Omit<OperationalDecisionCockpitProps, 'children'> & {
  phases: PhysicalExecutionPhase[];
  phaseNavLabel: string;
  children: ReactNode;
};

export function PhysicalExecutionCockpit({
  phases,
  phaseNavLabel,
  children,
  ...props
}: PhysicalExecutionCockpitProps) {
  return (
    <OperationalDecisionCockpit {...props}>
      <nav className={styles.phaseRail} aria-label={phaseNavLabel} data-physical-execution-cockpit='v8'>
        {phases.map((phase, index) => {
          const tone: OperationalTone = phase.state === 'complete'
            ? 'success'
            : phase.state === 'current'
              ? 'information'
              : phase.state === 'blocked'
                ? 'critical'
                : 'neutral';
          const className = [
            styles.phaseLink,
            phase.state === 'current' ? styles.phaseCurrent : '',
            phase.state === 'complete' ? styles.phaseComplete : '',
            phase.state === 'blocked' ? styles.phaseBlocked : '',
          ].filter(Boolean).join(' ');

          return (
            <Link
              key={phase.id}
              href={phase.href}
              className={className}
              aria-current={phase.state === 'current' ? 'step' : undefined}
              aria-disabled={phase.state === 'blocked' ? 'true' : undefined}
            >
              <span className={styles.phaseNumber}>{index + 1}</span>
              <span className={styles.phaseCopy}>
                <strong>{phase.label}</strong>
                <span>{phase.description}</span>
              </span>
              <StatusChip tone={tone}>{phase.stateLabel}</StatusChip>
            </Link>
          );
        })}
      </nav>
      {children}
    </OperationalDecisionCockpit>
  );
}

export type PhysicalExecutionDetail = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export function PhysicalExecutionDetailGrid({
  items,
  label,
}: {
  items: PhysicalExecutionDetail[];
  label: string;
}) {
  return (
    <section className={styles.detailGrid} aria-label={label}>
      {items.map((item) => (
        <article className={styles.detailCard} key={item.label}>
          <span className={styles.detailLabel}>{item.label}</span>
          <strong className={styles.detailValue}>{item.value}</strong>
          {item.hint ? <span className={styles.detailHint}>{item.hint}</span> : null}
        </article>
      ))}
    </section>
  );
}

export type PhysicalExecutionListItem = {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  href?: string;
  blocked?: boolean;
};

export function PhysicalExecutionList({
  items,
  label,
}: {
  items: PhysicalExecutionListItem[];
  label: string;
}) {
  return (
    <div className={styles.list} aria-label={label}>
      {items.map((item) => {
        const content = (
          <>
            <span className={styles.listCopy}>
              <strong>{item.title}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
              {item.meta ? <small>{item.meta}</small> : null}
            </span>
            {item.status ? <span className={styles.listStatus}>{item.status}</span> : null}
          </>
        );

        if (item.href && !item.blocked) {
          return <Link className={styles.listLink} href={item.href} key={item.id}>{content}</Link>;
        }

        return (
          <article
            className={`${styles.listItem} ${item.blocked ? styles.listBlocked : ''}`}
            key={item.id}
            aria-disabled={item.blocked ? 'true' : undefined}
          >
            {content}
          </article>
        );
      })}
    </div>
  );
}

export function PhysicalExecutionSplit({ children }: { children: ReactNode }) {
  return <div className={styles.split}>{children}</div>;
}

export function PhysicalExecutionPanel({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={styles.panel} id={id}>
      <header className={styles.panelHeader}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export const physicalExecutionClasses = {
  primaryLink: styles.primaryLink,
  secondaryLink: styles.secondaryLink,
  warningText: styles.warningText,
} as const;
