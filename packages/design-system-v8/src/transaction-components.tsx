import * as React from 'react';
import {
  NextActionCard,
  StatusChip,
  Surface as BaseSurface,
  type StatusTone,
  type SurfaceProps as BaseSurfaceProps,
} from './components';
import styles from './transaction-components.module.css';

export type SurfaceProps = Omit<BaseSurfaceProps, 'padded'> & {
  padding?: 'none' | 'compact' | 'comfortable' | 'field';
  elevation?: 'flat' | 'raised';
};

export function Surface({
  padding = 'comfortable',
  elevation = 'flat',
  className,
  ...props
}: SurfaceProps) {
  return (
    <BaseSurface
      {...props}
      padded={false}
      className={[
        styles.surface,
        styles[`padding${padding[0].toUpperCase()}${padding.slice(1)}`],
        elevation === 'raised' ? styles.raised : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    />
  );
}

export type StatusBadgeTone = StatusTone | 'danger' | 'info';
export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusBadgeTone };

function normalizeTone(tone: StatusBadgeTone): StatusTone {
  if (tone === 'danger') return 'critical';
  if (tone === 'info') return 'information';
  return tone;
}

export function StatusBadge({ tone = 'neutral', ...props }: StatusBadgeProps) {
  return <StatusChip {...props} tone={normalizeTone(tone)} />;
}

export type NextActionPanelProps = {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  blocker?: string;
  deadline?: string;
  moneyImpact?: string;
  action: React.ReactNode;
  secondaryAction?: React.ReactNode;
};

export function NextActionPanel({
  eyebrow,
  title,
  description,
  blocker,
  deadline,
  moneyImpact,
  action,
  secondaryAction,
}: NextActionPanelProps) {
  return (
    <NextActionCard
      label={typeof eyebrow === 'string' ? eyebrow : undefined}
      action={title}
      reason={description}
      blocked={Boolean(blocker)}
      impact={moneyImpact ?? blocker}
      deadline={deadline}
      actions={<>{action}{secondaryAction}</>}
    />
  );
}
