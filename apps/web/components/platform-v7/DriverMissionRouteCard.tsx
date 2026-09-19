import type { CSSProperties } from 'react';

export type DriverPhotoChecklistItem = {
  readonly label: string;
  readonly done: boolean;
};

export type DriverMissionRouteCardProps = {
  readonly tripId: string;
  readonly route: string;
  /** Доля пройденного пути 0..100 */
  readonly progressPercent: number;
  readonly stageLabel: string;
  readonly photoChecklist: readonly DriverPhotoChecklistItem[];
};

const micro: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--pc-text-muted, #58606E)',
};

export function DriverMissionRouteCard({ tripId, route, progressPercent, stageLabel, photoChecklist }: DriverMissionRouteCardProps) {
  const progress = Math.min(Math.max(progressPercent, 0), 100);
  const doneCount = photoChecklist.filter((item) => item.done).length;

  return (
    <section
      aria-label={`Текущий рейс ${tripId}`}
      data-testid='driver-mission-route-card'
      style={{
        background: 'var(--pc-bg-card, #fff)',
        border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
        borderRadius: 16,
        padding: '18px 20px',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={micro}>Рейс</span>
        <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--pc-text-primary, #0F1419)' }}>{tripId}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--pc-accent, #0A7A5F)' }}>{stageLabel}</span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--pc-text-primary, #0F1419)' }}>{route}</div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div
          role='progressbar'
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Пройдено ${progress}% пути`}
          data-route-pulse='true'
          style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--p7-color-surface-strong, #EFEAE0)', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              insetBlock: 0,
              left: 0,
              width: `${progress}%`,
              borderRadius: 999,
              background: 'var(--pc-accent, #0A7A5F)',
            }}
          />
          <div
            aria-hidden='true'
            className='p7-route-pulse-dot'
            style={{
              position: 'absolute',
              top: '50%',
              left: `calc(${progress}% - 5px)`,
              width: 10,
              height: 10,
              marginTop: -5,
              borderRadius: 999,
              background: 'var(--pc-accent, #0A7A5F)',
              boxShadow: '0 0 0 3px rgba(10,122,95,0.2)',
            }}
          />
        </div>
        <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--pc-text-secondary, #475569)' }}>
          {progress}% пути · точка из телематики; финансовых действий на экране нет
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={micro}>Фото-чеклист</span>
          <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--pc-text-primary, #0F1419)' }}>
            {doneCount} из {photoChecklist.length}
          </span>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {photoChecklist.map((item) => (
            <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span
                aria-hidden='true'
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  color: item.done ? '#fff' : 'var(--pc-text-muted, #58606E)',
                  background: item.done ? 'var(--pc-accent, #0A7A5F)' : 'var(--p7-color-surface-strong, #EFEAE0)',
                }}
              >
                {item.done ? '✓' : ''}
              </span>
              <span style={{ color: item.done ? 'var(--pc-text-secondary, #475569)' : 'var(--pc-text-primary, #0F1419)', fontWeight: item.done ? 500 : 700 }}>
                {item.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: item.done ? 'var(--pc-success, #027A48)' : 'var(--pc-warning, #B54708)' }}>
                {item.done ? 'готово' : 'ожидается'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
