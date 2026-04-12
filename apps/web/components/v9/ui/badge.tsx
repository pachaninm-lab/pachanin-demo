import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/v9/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-text-muted',
        success: 'bg-[rgba(22,163,74,0.1)] text-success',
        warning: 'bg-[rgba(217,119,6,0.1)] text-warning',
        danger: 'bg-[rgba(220,38,38,0.1)] text-danger',
        info: 'bg-[rgba(2,132,199,0.1)] text-info',
        brand: 'bg-[rgba(10,122,95,0.1)] text-brand',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background:
              variant === 'success' ? '#16A34A'
              : variant === 'warning' ? '#D97706'
              : variant === 'danger' ? '#DC2626'
              : variant === 'info' ? '#0284C7'
              : variant === 'brand' ? '#0A7A5F'
              : '#6B778C',
          }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
