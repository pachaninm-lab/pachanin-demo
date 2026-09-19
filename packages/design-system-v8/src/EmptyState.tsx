import type { HTMLAttributes, ReactNode } from 'react';
import styles from './EmptyState.module.css';

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      {...props}
      className={[styles.root, className].filter(Boolean).join(' ')}
      role={props.role ?? 'status'}
    >
      <span className={styles.icon} aria-hidden='true'>{icon ?? '∅'}</span>
      <strong className={styles.title}>{title}</strong>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
