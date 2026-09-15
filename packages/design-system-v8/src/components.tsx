import * as React from 'react';
import styles from './components.module.css';

type Tone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';
type ButtonVariant = 'primary' | 'secondary' | 'danger';
type SurfaceVariant = 'default' | 'plain' | 'subtle';
type TextStackSpacing = 'label' | 'title' | 'paragraph' | 'action';
type TextStackAlign = 'start' | 'center' | 'stretch';

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

const textStackSpacingClasses: Record<TextStackSpacing, string> = {
  label: styles.textStackLabel,
  title: styles.textStackTitle,
  paragraph: styles.textStackParagraph,
  action: styles.textStackAction,
};

const textStackAlignClasses: Record<TextStackAlign, string> = {
  start: styles.textStackStart,
  center: styles.textStackCenter,
  stretch: styles.textStackStretch,
};

export type TextStackProps = React.HTMLAttributes<HTMLDivElement> & {
  spacing?: TextStackSpacing;
  align?: TextStackAlign;
};

export function TextStack({ spacing = 'title', align = 'stretch', className, ...props }: TextStackProps) {
  return (
    <div
      {...props}
      data-text-stack={spacing}
      className={cx(styles.textStack, textStackSpacingClasses[spacing], textStackAlignClasses[align], className)}
    />
  );
}

export type ProseProps = React.HTMLAttributes<HTMLDivElement>;

export function Prose({ className, ...props }: ProseProps) {
  return <div {...props} data-prose='true' className={cx(styles.prose, className)} />;
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
