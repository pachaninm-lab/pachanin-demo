import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusChip } from '@pc/design-system-v8';
import {
  OperationalDecisionCockpit,
  type OperationalDecisionCockpitProps,
  type OperationalTone,
} from './OperationalDecisionCockpit';
import styles from './AuctionExecutionCockpit.module.css';

export type AuctionPhaseId = 'import' | 'admission' | 'bids' | 'deal-basis';
export type AuctionPhaseState = 'complete' | 'current' | 'available' | 'blocked';

export type AuctionPhase = {
  id: AuctionPhaseId;
  href: string;
  label: string;
  description: string;
  state: AuctionPhaseState;
  stateLabel: string;
};

export type AuctionExecutionCockpitProps = Omit<OperationalDecisionCockpitProps, 'children'> & {
  phases: AuctionPhase[];
  phaseNavLabel: string;
  children: ReactNode;
};

export function AuctionExecutionCockpit({ phases, phaseNavLabel, children, ...props }: AuctionExecutionCockpitProps) {
  return (
    <OperationalDecisionCockpit {...props}>
      <nav className={styles.phaseRail} aria-label={phaseNavLabel} data-auction-execution-cockpit='v8'>
        {phases.map((phase, index) => {
          const tone: OperationalTone = phase.state === 'complete'
            ? 'success'
            : phase.state === 'current'
              ? 'information'
              : phase.state === 'blocked'
                ? 'critical'
                : 'neutral';
          const className = phase.state === 'current'
            ? `${styles.phaseLink} ${styles.phaseCurrent}`
            : phase.state === 'complete'
              ? `${styles.phaseLink} ${styles.phaseComplete}`
              : phase.state === 'blocked'
                ? `${styles.phaseLink} ${styles.phaseBlocked}`
                : styles.phaseLink;

          return (
            <Link key={phase.id} href={phase.href} className={className} aria-current={phase.state === 'current' ? 'step' : undefined}>
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

export type AuctionDetail = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: OperationalTone;
};

export function AuctionDetailGrid({ items, label }: { items: AuctionDetail[]; label: string }) {
  return (
    <section className={styles.detailGrid} aria-label={label}>
      {items.map((item) => (
        <article className={styles.detailCard} key={item.label}>
          <span className={styles.detailLabel}>{item.label}</span>
          <strong className={styles.detailValue}>{item.value}</strong>
          {item.hint ? <span className={styles.detailHint}>{item.hint}</span> : null}
          {item.tone ? <StatusChip tone={item.tone}>{item.label}</StatusChip> : null}
        </article>
      ))}
    </section>
  );
}

export type AuctionListItem = {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  href?: string;
};

export function AuctionList({ items, label }: { items: AuctionListItem[]; label: string }) {
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
        return item.href ? (
          <Link className={styles.listLink} href={item.href} key={item.id}>{content}</Link>
        ) : (
          <article className={styles.listItem} key={item.id}>{content}</article>
        );
      })}
    </div>
  );
}

export function AuctionSplit({ children }: { children: ReactNode }) {
  return <div className={styles.split}>{children}</div>;
}

export function AuctionPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export const auctionCockpitClasses = {
  primaryLink: styles.primaryLink,
  secondaryLink: styles.secondaryLink,
  warningText: styles.warningText,
} as const;
