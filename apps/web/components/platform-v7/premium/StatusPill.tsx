import type { ReactNode } from 'react';

export type PremiumTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export function StatusPill({
  children,
  tone = 'success',
  withDot = true,
}: {
  children: ReactNode;
  tone?: PremiumTone;
  withDot?: boolean;
}) {
  return (
    <span className='pc-prem-pill' data-tone={tone}>
      {withDot ? <span className='pc-prem-pill__dot' aria-hidden='true' /> : null}
      {children}
    </span>
  );
}
