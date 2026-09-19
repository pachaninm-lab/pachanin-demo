import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Info,
  type LucideIcon,
} from 'lucide-react';
import {
  GRAIN_EXECUTION_COCKPIT_THEME,
  GRAIN_EXECUTION_ROLE_LABELS,
  GRAIN_EXECUTION_STATUS_TONES,
  type GrainExecutionRole,
  type GrainExecutionTheme,
  type GrainExecutionTone,
} from '@/lib/platform-v7/design/execution-cockpit';
import styles from './ExecutionDesignSystem.module.css';

export type ExecutionTheme = GrainExecutionTheme;
export type ExecutionTone = GrainExecutionTone;
export type ExecutionActionTone = 'primary' | 'secondary' | 'warning' | 'danger';

export type ExecutionRole = GrainExecutionRole;

export interface ExecutionAction {
  readonly label: string;
  readonly href?: string;
  readonly disabled?: boolean;
  readonly tone?: ExecutionActionTone;
  readonly onClick?: () => void;
}

export interface ExecutionOperationalCardProps {
  readonly title: string;
  readonly status: string;
  readonly statusTone?: ExecutionTone;
  readonly shortFact: string;
  readonly blocker?: string;
  readonly blockerTone?: 'warning' | 'danger' | 'success';
  readonly nextStep: string;
  readonly action: ExecutionAction;
  readonly cause?: string;
  readonly testId?: string;
}

export const EXECUTION_ROLE_LABELS = GRAIN_EXECUTION_ROLE_LABELS;
export const EXECUTION_STATUS_TONES = GRAIN_EXECUTION_STATUS_TONES;

const statusIcons: Record<ExecutionTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock3,
  danger: AlertTriangle,
  info: Info,
  money: CircleDollarSign,
  neutral: Info,
};

function cssMinWidth(min: number): CSSProperties {
  return { '--ged-grid-min': `${min}px` } as CSSProperties;
}

export function ExecutionCanvas({
  title,
  eyebrow,
  subtitle,
  role,
  theme = GRAIN_EXECUTION_COCKPIT_THEME.defaultTheme,
  meta,
  children,
  testId,
}: {
  readonly title?: string;
  readonly eyebrow?: string;
  readonly subtitle?: string;
  readonly role?: ExecutionRole;
  readonly theme?: ExecutionTheme;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className={styles.canvas} data-theme={theme} data-testid={testId}>
      <div className={styles.frame}>
        {title ? (
          <header className={styles.header}>
            <div className={styles.headerMain}>
              {eyebrow || role ? <p className={styles.eyebrow}>{eyebrow ?? EXECUTION_ROLE_LABELS[role as ExecutionRole]}</p> : null}
              <h1 className={styles.title}>{title}</h1>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            {meta ? <div className={styles.headerMeta}>{meta}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function ExecutionCardGrid({
  children,
  min = 240,
  testId,
}: {
  readonly children: ReactNode;
  readonly min?: number;
  readonly testId?: string;
}) {
  return (
    <section className={styles.grid} style={cssMinWidth(min)} data-testid={testId}>
      {children}
    </section>
  );
}

export function ExecutionStatusBadge({
  children,
  tone = 'neutral',
}: {
  readonly children: ReactNode;
  readonly tone?: ExecutionTone;
}) {
  const Icon = statusIcons[tone];
  const meaning = EXECUTION_STATUS_TONES[tone].meaning;
  return (
    <span className={styles.statusBadge} data-tone={tone} aria-label={`${EXECUTION_STATUS_TONES[tone].label}: ${meaning}`}>
      <Icon size={14} aria-hidden='true' />
      {children}
    </span>
  );
}

export function ExecutionActionButton({ action }: { readonly action: ExecutionAction }) {
  const tone = action.tone ?? 'primary';
  const content = (
    <>
      <span>{action.label}</span>
      <ArrowRight size={15} aria-hidden='true' />
    </>
  );

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={styles.actionButton}
        data-tone={tone}
        aria-disabled={action.disabled ? 'true' : undefined}
        tabIndex={action.disabled ? -1 : undefined}
        onClick={action.disabled ? (event) => event.preventDefault() : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type='button' className={styles.actionButton} data-tone={tone} disabled={action.disabled} onClick={action.onClick}>
      {content}
    </button>
  );
}

export function ExecutionKpiCard({
  label,
  value,
  note,
  tone = 'neutral',
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly tone?: ExecutionTone;
  readonly testId?: string;
}) {
  return (
    <article className={styles.kpiCard} data-testid={testId}>
      <ExecutionStatusBadge tone={tone}>{label}</ExecutionStatusBadge>
      <p className={styles.kpiValue}>{value}</p>
      {note ? <p className={styles.kpiNote}>{note}</p> : null}
    </article>
  );
}

export function ExecutionOperationalCard({
  title,
  status,
  statusTone = 'neutral',
  shortFact,
  blocker,
  blockerTone = 'warning',
  cause,
  nextStep,
  action,
  testId,
}: ExecutionOperationalCardProps) {
  const blockerText = blocker ?? 'Активного стопа нет';
  const blockerStatusTone = blockerTone === 'danger' ? 'danger' : blockerTone === 'success' ? 'success' : 'warning';

  return (
    <article className={styles.operationalCard} data-testid={testId}>
      <div className={styles.cardTop}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <ExecutionStatusBadge tone={statusTone}>{status}</ExecutionStatusBadge>
      </div>

      <div className={styles.cardBody}>
        <FactBlock label='Короткий факт' value={shortFact} />
        <div className={styles.blocker} data-tone={blockerTone}>
          <FactBlock label={blocker ? 'Блокер / причина' : 'Блокер'} value={blockerText} />
          {cause ? <FactBlock label='Основание' value={cause} /> : null}
          <ExecutionStatusBadge tone={blockerStatusTone}>{blockerText}</ExecutionStatusBadge>
        </div>
        <FactBlock label='Следующий шаг' value={nextStep} />
      </div>

      <div className={styles.actions}>
        <ExecutionActionButton action={action} />
      </div>
    </article>
  );
}

function FactBlock({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={styles.factBlock}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}
