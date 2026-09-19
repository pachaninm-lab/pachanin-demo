import * as React from 'react';
import { cn } from '@/lib/v9/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('v9-empty', className)} role="status" aria-live="polite">
      {icon && (
        <div className="v9-empty-icon" aria-hidden>{icon}</div>
      )}
      <p className="v9-empty-title">{title}</p>
      {description && <p className="v9-empty-desc">{description}</p>}
      {action}
    </div>
  );
}
