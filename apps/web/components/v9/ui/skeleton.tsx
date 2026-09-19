import * as React from 'react';
import { cn } from '@/lib/v9/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('v9-skeleton rounded-md', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
