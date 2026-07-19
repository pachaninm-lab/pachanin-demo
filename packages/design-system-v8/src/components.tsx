import * as React from 'react';
import styles from './components.module.css';

type Tone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';
type ButtonVariant = 'primary' | 'secondary' | 'danger';
type SurfaceVariant = 'default' | 'plain' | 'subtle';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  padded?: boolean;
};

export function Surface({ variant = 'default', padded = true, className, ...props }: SurfaceProps) {
  return (
    <div
      {...props}
      className={cx(
        styles.surface,
        variant === 'plain' && styles.surfacePlain,
        variant === 'subtle' && styles.surfaceSubtle,
        padded && styles.surfacePadded,
        className,
      )}
    />
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', fullWidth = false, className, type, ...props },
  ref,
) {
  const safeType: 'button' | 'submit' | 'reset' = type ?? 'button';
  return (
    <button
      {...props}
      ref={ref}
      type={safeType}
      className={cx(
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        fullWidth && styles.buttonFull,
        className,
      )}
    />
  );
});

const toneClasses: Record<Tone, string> = {
  neutral: styles.chipNeutral,
  success: styles.chipSuccess,
  warning: styles.chipWarning,
  critical: styles.chipCritical,
  information: styles.chipInformation,
};

export type StatusChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function StatusChip({ tone = 'neutral', className, ...props }: StatusChipProps) {
  return <span {...props} className={cx(styles.chip, toneClasses[tone], className)} />;
}

const noticeToneClasses: Record<Tone, string> = {
  neutral: styles.noticeNeutral,
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
  critical: styles.noticeCritical,
  information: styles.noticeInformation,
};

export type InlineNoticeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
};

export function InlineNotice({ tone = 'neutral', icon, title, children, className, ...props }: InlineNoticeProps) {
  return (
    <div
      {...props}
      className={cx(styles.notice, noticeToneClasses[tone], className)}
      role={tone === 'critical' ? 'alert' : props.role}
    >
      <span aria-hidden='true'>{icon}</span>
      <div className={styles.noticeCopy}>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

export type NextActionCardProps = React.HTMLAttributes<HTMLElement> & {
  action: string;
  reason?: string;
  label?: string;
  icon?: React.ReactNode;
  blocked?: boolean;
  impact?: string;
  owner?: string;
  deadline?: string;
  actions?: React.ReactNode;
};

export function NextActionCard({
  action,
  reason,
  label = 'Следующее действие',
  icon,
  blocked = false,
  impact,
  owner,
  deadline,
  actions,
  className,
  ...props
}: NextActionCardProps) {
  const meta = [
    impact ? { label: 'Влияние', value: impact } : null,
    owner ? { label: 'Ответственный', value: owner } : null,
    deadline ? { label: 'Срок', value: deadline } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <section
      {...props}
      className={cx(styles.nextAction, blocked && styles.nextActionBlocked, className)}
      aria-labelledby={props['aria-labelledby'] || undefined}
    >
      <div className={styles.nextActionHeader}>
        <div className={styles.nextActionIcon} aria-hidden='true'>{icon}</div>
        <div className={styles.nextActionCopy}>
          <span className={styles.nextActionLabel}>{label}</span>
          <h2 className={styles.nextActionTitle}>{action}</h2>
          {reason ? <p className={styles.nextActionReason}>{reason}</p> : null}
        </div>
      </div>

      {meta.length > 0 ? (
        <dl className={styles.nextActionMeta}>
          {meta.map((item) => (
            <div key={item.label} className={styles.nextActionMetaItem}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className={styles.nextActionActions}>{actions}</div> : null}
    </section>
  );
}

/* ── Semantic deal domains ─────────────────────────────────────────
   The colour vocabulary that makes a screen readable at a glance. */
export type DomainKey =
  | 'money'
  | 'document'
  | 'evidence'
  | 'logistics'
  | 'quality'
  | 'dispute'
  | 'admission';

const domainClasses: Record<DomainKey, string> = {
  money: styles.domainMoney,
  document: styles.domainDocument,
  evidence: styles.domainEvidence,
  logistics: styles.domainLogistics,
  quality: styles.domainQuality,
  dispute: styles.domainDispute,
  admission: styles.domainAdmission,
};

export type DomainTagProps = React.HTMLAttributes<HTMLSpanElement> & {
  domain: DomainKey;
};

export function DomainTag({ domain, className, ...props }: DomainTagProps) {
  return <span {...props} className={cx(styles.domainTag, domainClasses[domain], className)} />;
}

/* ── RecordHeader ──────────────────────────────────────────────────
   Every object in an industrial system has a number, a status, a time
   and an author. The number is selectable so it can be read out or
   copied when people talk on the phone. */
export type RecordHeaderProps = React.HTMLAttributes<HTMLElement> & {
  recordId: string;
  title: string;
  recordLabel?: string;
  status?: React.ReactNode;
  timestamp?: string;
  actor?: string;
  copyHint?: string;
  actions?: React.ReactNode;
};

export function RecordHeader({
  recordId,
  title,
  recordLabel = 'Номер',
  status,
  timestamp,
  actor,
  copyHint = 'Нажмите и удерживайте, чтобы выделить и скопировать',
  actions,
  className,
  ...props
}: RecordHeaderProps) {
  const meta = [timestamp, actor].filter(Boolean).join(' · ');
  return (
    <header {...props} className={cx(styles.record, className)}>
      <div className={styles.recordMain}>
        <div className={styles.recordIdRow}>
          <span className={styles.recordIdLabel}>{recordLabel}</span>
          <code className={styles.recordId} title={copyHint}>{recordId}</code>
          {status ? <span className={styles.recordStatus}>{status}</span> : null}
        </div>
        <h1 className={styles.recordTitle}>{title}</h1>
        {meta ? <p className={styles.recordMeta}>{meta}</p> : null}
      </div>
      {actions ? <div className={styles.recordActions}>{actions}</div> : null}
    </header>
  );
}

/* ── EvidenceSeal ──────────────────────────────────────────────────
   A proof rendered as a document stamp: what it proves, its hash, when
   and by whom. This is the brand object of the platform. */
export type EvidenceSealProps = React.HTMLAttributes<HTMLDivElement> & {
  kind: string;
  hash: string;
  timestamp: string;
  signer: string;
  domain?: DomainKey;
  verified?: boolean;
  verifiedLabel?: string;
  hashLabel?: string;
};

export function EvidenceSeal({
  kind,
  hash,
  timestamp,
  signer,
  domain = 'evidence',
  verified = true,
  verifiedLabel = 'Подтверждено',
  hashLabel = 'Отпечаток',
  className,
  ...props
}: EvidenceSealProps) {
  return (
    <div {...props} className={cx(styles.seal, domainClasses[domain], className)}>
      <div className={styles.sealTop}>
        <span className={styles.sealKind}>{kind}</span>
        {verified ? (
          <span className={styles.sealVerified}>
            <svg width='16' height='16' viewBox='0 0 16 16' aria-hidden='true' focusable='false'>
              <path
                d='M6.2 10.6 3.6 8l-1 1 3.6 3.6L14 5.8l-1-1z'
                fill='currentColor'
              />
            </svg>
            {verifiedLabel}
          </span>
        ) : null}
      </div>
      <dl className={styles.sealBody}>
        <div>
          <dt>{hashLabel}</dt>
          <dd><code className={styles.sealHash} title='Нажмите и удерживайте, чтобы выделить'>{hash}</code></dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>{timestamp}</dd>
        </div>
        <div>
          <dt>Кто подтвердил</dt>
          <dd>{signer}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ── Callout ───────────────────────────────────────────────────────
   Mandatory error/notice format: what happened → why → what to do,
   with the action that fixes it. Never a dead end. */
export type CalloutTone = 'critical' | 'warning' | 'success' | 'information' | 'neutral';

const calloutToneClasses: Record<CalloutTone, string> = {
  critical: styles.calloutCritical,
  warning: styles.calloutWarning,
  success: styles.calloutSuccess,
  information: styles.calloutInformation,
  neutral: styles.calloutNeutral,
};

export type CalloutProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: CalloutTone;
  title: string;
  reason?: string;
  nextStep?: string;
  nextStepLabel?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export function Callout({
  tone = 'information',
  title,
  reason,
  nextStep,
  nextStepLabel = 'Что делать',
  icon,
  action,
  className,
  ...props
}: CalloutProps) {
  return (
    <div
      {...props}
      className={cx(styles.callout, calloutToneClasses[tone], className)}
      role={tone === 'critical' ? 'alert' : props.role}
    >
      {icon ? <span className={styles.calloutIcon} aria-hidden='true'>{icon}</span> : null}
      <div className={styles.calloutCopy}>
        <strong className={styles.calloutTitle}>{title}</strong>
        {reason ? <p className={styles.calloutReason}>{reason}</p> : null}
        {nextStep ? (
          <p className={styles.calloutNext}>
            <span className={styles.calloutNextLabel}>{nextStepLabel}:</span> {nextStep}
          </p>
        ) : null}
        {action ? <div className={styles.calloutAction}>{action}</div> : null}
      </div>
    </div>
  );
}

/* ── ConfirmSummary ────────────────────────────────────────────────
   Before an irreversible step (pay, sign, cancel a deal) restate the
   consequence in plain language and let the person confirm or step back. */
export type ConfirmSummaryLine = {
  label: string;
  value: string;
  domain?: DomainKey;
};

export type ConfirmSummaryProps = React.HTMLAttributes<HTMLElement> & {
  title: string;
  lines: ConfirmSummaryLine[];
  consequence: string;
  confirm: React.ReactNode;
  cancel?: React.ReactNode;
};

export function ConfirmSummary({
  title,
  lines,
  consequence,
  confirm,
  cancel,
  className,
  ...props
}: ConfirmSummaryProps) {
  return (
    <section {...props} className={cx(styles.confirm, className)} aria-label={title}>
      <h2 className={styles.confirmTitle}>{title}</h2>
      <dl className={styles.confirmLines}>
        {lines.map((line) => (
          <div key={line.label} className={styles.confirmLine}>
            <dt>{line.label}</dt>
            <dd className={line.domain ? cx(styles.confirmValueDomain, domainClasses[line.domain]) : undefined}>
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.confirmConsequence}>{consequence}</p>
      <div className={styles.confirmActions}>
        {confirm}
        {cancel}
      </div>
    </section>
  );
}

/* ── Field ─────────────────────────────────────────────────────────
   One label, one control, an example hint, one error. Wired for
   screen readers via aria-describedby. */
export type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  optionalLabel = 'необязательно',
  children,
  className,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cx(styles.field, error && styles.fieldInvalid, className)}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        <span>{label}</span>
        {!required ? <span className={styles.fieldOptional}>{optionalLabel}</span> : null}
      </label>
      {hint ? <p className={styles.fieldHint} id={hintId}>{hint}</p> : null}
      <div className={styles.fieldControl} data-describe={[hintId, errorId].filter(Boolean).join(' ') || undefined}>
        {children}
      </div>
      {error ? (
        <p className={styles.fieldError} id={errorId} role='alert'>{error}</p>
      ) : null}
    </div>
  );
}
