import type { ReactNode } from 'react';
import {
  StatusBadge,
  Surface,
  WorkbenchTemplate,
  type StatusTone,
} from '@pc/design-system-v8';
import styles from './FieldTaskTemplate.module.css';

export type FieldTaskTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: StatusTone;
  primary: ReactNode;
  context?: ReactNode;
  evidence?: ReactNode;
  liveStatus?: ReactNode;
  testId?: string;
};

export function FieldTaskTemplate({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  primary,
  context,
  evidence,
  liveStatus,
  testId,
}: FieldTaskTemplateProps) {
  return (
    <div className={styles.root} data-testid={testId}>
      {liveStatus}
      <WorkbenchTemplate
        density='field'
        title={(
          <span className={styles.heading}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <span>{title}</span>
          </span>
        )}
        description={description}
        status={<StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>}
        primary={primary}
        secondary={context ? <Surface>{context}</Surface> : undefined}
        evidence={evidence}
      />
    </div>
  );
}

export type IntakeWorkbenchTemplateProps = FieldTaskTemplateProps & {
  intakeSummary: ReactNode;
};

export function IntakeWorkbenchTemplate({ intakeSummary, context, ...props }: IntakeWorkbenchTemplateProps) {
  return (
    <FieldTaskTemplate
      {...props}
      context={(
        <div className={styles.contextStack}>
          <section aria-label='Сводка приёмки'>{intakeSummary}</section>
          {context}
        </div>
      )}
    />
  );
}
