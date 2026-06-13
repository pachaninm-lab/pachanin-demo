import type { ReactNode } from 'react';
import { PremiumIcon, type PremiumGlyph } from './icons';
import type { PremiumTone } from './StatusPill';

export function PremiumStatCard({
  value,
  label,
  glyph,
  icon,
  tone = 'success',
}: {
  value: ReactNode;
  label: ReactNode;
  glyph?: PremiumGlyph;
  icon?: ReactNode;
  tone?: PremiumTone;
}) {
  return (
    <div className='pc-prem-kpi' data-tone={tone}>
      <span className='pc-prem-kpi__icon'>{icon ?? (glyph ? <PremiumIcon glyph={glyph} /> : null)}</span>
      <span className='pc-prem-kpi__value'>{value}</span>
      <span className='pc-prem-kpi__label'>{label}</span>
    </div>
  );
}
