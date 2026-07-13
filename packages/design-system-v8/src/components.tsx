import * as React from 'react';
import styles from './components.module.css';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';
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

const toneClasses: Record<StatusTone, string> = {
  neutral: styles.chipNeutral,
  success: styles.chipSuccess,
  warning: styles.chipWarning,
  critical: styles.chipCritical,
  information: styles.chipInformation,
};

export type StatusChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function StatusChip({ tone = 'neutral', className, ...props }: StatusChipProps) {
  return <span {...props} className={cx(styles.chip, toneClasses[tone], className)} />;
}

const noticeToneClasses: Record<StatusTone, string> = {
  neutral: styles.noticeNeutral,
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
  critical: styles.noticeCritical,
  information: styles.noticeInformation,
};

export type InlineNoticeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: StatusTone;
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

export function KeyFactGrid({ children, className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl {...props} className={cx(styles.keyFactGrid, className)}>{children}</dl>;
}

export type KeyFactProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export function KeyFact({ label, value, hint }: KeyFactProps) {
  return (
    <div className={styles.keyFact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export type WorkbenchTemplateProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  evidence?: React.ReactNode;
  density?: 'compact' | 'comfortable' | 'field';
};

export function WorkbenchTemplate({
  title,
  description,
  status,
  primary,
  secondary,
  evidence,
  density = 'comfortable',
}: WorkbenchTemplateProps) {
  return (
    <div className={styles.workbench} data-density={density}>
      <header className={styles.workbenchHeader}>
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {status}
      </header>
      <section className={styles.workbenchMain} aria-label='Рабочая область'>
        <div className={styles.workbenchPrimary}>{primary}</div>
        {secondary ? <aside className={styles.workbenchSecondary}>{secondary}</aside> : null}
      </section>
      {evidence ? <section className={styles.workbenchEvidence} aria-label='Доказательства'>{evidence}</section> : null}
    </div>
  );
}

export type AiTransparencyProps = {
  facts: React.ReactNode;
  inference?: React.ReactNode;
  sources?: React.ReactNode;
  limitation?: React.ReactNode;
  reviewRequired?: boolean;
};

export function AiTransparency({
  facts,
  inference,
  sources,
  limitation,
  reviewRequired = true,
}: AiTransparencyProps) {
  return (
    <Surface className={styles.aiTransparency} aria-label='Основание рекомендации ИИ'>
      <header>
        <div>
          <span className={styles.nextActionLabel}>ИИ-помощник</span>
          <h2>Основание рекомендации</h2>
        </div>
        <StatusChip tone={reviewRequired ? 'warning' : 'success'}>
          {reviewRequired ? 'Нужна проверка человеком' : 'Проверено'}
        </StatusChip>
      </header>
      <dl>
        <div><dt>Факты</dt><dd>{facts}</dd></div>
        {inference ? <div><dt>Вывод</dt><dd>{inference}</dd></div> : null}
        {sources ? <div><dt>Источники</dt><dd>{sources}</dd></div> : null}
        {limitation ? <div><dt>Ограничения</dt><dd>{limitation}</dd></div> : null}
      </dl>
    </Surface>
  );
}

export type AppFrameProps = {
  header: React.ReactNode;
  navigation: React.ReactNode;
  children: React.ReactNode;
  mobileNavigation?: React.ReactNode;
  drawerOpen?: boolean;
};

export function AppFrame({ header, navigation, children, mobileNavigation, drawerOpen = false }: AppFrameProps) {
  return (
    <div className={styles.appFrame} data-drawer-open={drawerOpen ? 'true' : 'false'}>
      <header className={styles.appHeader}>{header}</header>
      <aside className={styles.appNavigation} aria-label='Основная навигация'>{navigation}</aside>
      <main className={styles.appMain} id='main-content'>{children}</main>
      {mobileNavigation ? <nav className={styles.appMobileNavigation} aria-label='Навигация кабинета'>{mobileNavigation}</nav> : null}
    </div>
  );
}
