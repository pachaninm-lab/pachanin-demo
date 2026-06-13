import type { ReactNode } from 'react';
import type { PremiumTone } from './StatusPill';

const TONE_STROKE: Record<PremiumTone, string> = {
  success: 'var(--pc-prem-green)',
  info: 'var(--pc-prem-info)',
  warning: 'var(--pc-prem-warn)',
  danger: 'var(--pc-prem-danger)',
  neutral: 'var(--pc-prem-text-muted)',
};

export function TrendSparkline({
  points,
  tone = 'success',
  width = 240,
  height = 56,
  deltaLabel,
  deltaTone,
  caption,
  ariaLabel = 'Тренд',
}: {
  points: readonly number[];
  tone?: PremiumTone;
  width?: number;
  height?: number;
  deltaLabel?: ReactNode;
  deltaTone?: 'success' | 'danger';
  caption?: ReactNode;
  ariaLabel?: string;
}) {
  const safe = points.length >= 2 ? points : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (safe.length - 1);

  const coords = safe.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p - min) / span);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${height - pad} L${coords[0][0].toFixed(1)} ${height - pad} Z`;
  const gradId = `pc-prem-spark-${tone}-${safe.length}`;

  return (
    <div className='pc-prem-spark'>
      <svg width='100%' height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' role='img' aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={TONE_STROKE[tone]} stopOpacity='0.22' />
            <stop offset='100%' stopColor={TONE_STROKE[tone]} stopOpacity='0' />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill='none' stroke={TONE_STROKE[tone]} strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' />
      </svg>
      {deltaLabel || caption ? (
        <div className='pc-prem-spark__row'>
          {deltaLabel ? (
            <span className='pc-prem-spark__delta' data-tone={deltaTone === 'danger' ? 'danger' : undefined}>
              {deltaLabel}
            </span>
          ) : null}
          {caption ? <span className='pc-prem-spark__caption'>{caption}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
