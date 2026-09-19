import type { ReactNode } from 'react';
import type { PremiumTone } from './StatusPill';

const TONE_STROKE: Record<PremiumTone, string> = {
  success: 'var(--pc-prem-green)',
  info: 'var(--pc-prem-info)',
  warning: 'var(--pc-prem-warn)',
  danger: 'var(--pc-prem-danger)',
  neutral: 'var(--pc-prem-text-muted)',
};

export function DonutGauge({
  value,
  centerValue,
  sublabel,
  caption,
  tone = 'success',
  size = 116,
  thickness = 11,
}: {
  /** 0..100 fraction of the ring that is filled */
  value: number;
  /** text shown in the centre; defaults to `${value}%` */
  centerValue?: ReactNode;
  sublabel?: ReactNode;
  caption?: ReactNode;
  tone?: PremiumTone;
  size?: number;
  thickness?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className='pc-prem-gauge'>
      <div className='pc-prem-gauge__ring' style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role='img' aria-label={`${clamped}%`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke='var(--pc-prem-border)'
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={TONE_STROKE[tone]}
            strokeWidth={thickness}
            strokeLinecap='round'
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className='pc-prem-gauge__center'>
          <span className='pc-prem-gauge__value'>{centerValue ?? `${clamped}%`}</span>
          {sublabel ? <span className='pc-prem-gauge__sublabel'>{sublabel}</span> : null}
        </div>
      </div>
      {caption ? <span className='pc-prem-gauge__caption'>{caption}</span> : null}
    </div>
  );
}
