import type { CSSProperties } from 'react';

export type WeighStationPanelProps = {
  readonly tripId: string;
  readonly declaredTons: number;
  readonly acceptedTons: number;
  /** Допустимое отклонение в тоннах, по модулю */
  readonly toleranceTons?: number;
  readonly note?: string;
};

export function formatTons(tons: number): string {
  return `${tons.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} т`;
}

const valueStyle: CSSProperties = {
  fontSize: 40,
  lineHeight: 1.02,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
};

export function WeighStationPanel({ tripId, declaredTons, acceptedTons, toleranceTons = 0, note }: WeighStationPanelProps) {
  const deviation = Math.round((acceptedTons - declaredTons) * 10) / 10;
  const exceeded = Math.abs(deviation) > toleranceTons;
  const deviationColor = exceeded ? 'var(--pc-danger, #B42318)' : 'var(--pc-success, #027A48)';
  const deviationText = exceeded
    ? 'расхождение сверх допуска — нужен акт расхождения'
    : 'в пределах допуска';

  const cells = [
    { label: 'Заявлено', value: formatTons(declaredTons), color: 'var(--pc-text-primary, #0F1419)' },
    { label: 'Принято на весовой', value: formatTons(acceptedTons), color: 'var(--pc-text-primary, #0F1419)' },
    { label: 'Отклонение', value: `${deviation > 0 ? '+' : ''}${formatTons(deviation)}`, color: deviationColor },
  ];

  return (
    <section
      aria-label={`Весовая · ${tripId}`}
      data-testid='weigh-station-panel'
      style={{
        background: 'var(--pc-bg-card, #fff)',
        border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
        borderRadius: 16,
        padding: '20px 22px',
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pc-text-muted, #667085)' }}>
          Весовая
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--pc-text-secondary, #475569)' }}>{tripId}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: deviationColor }}>{deviationText}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {cells.map((cell) => (
          <div key={cell.label} style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #667085)' }}>{cell.label}</div>
            <div style={{ ...valueStyle, color: cell.color, overflowWrap: 'anywhere' }}>{cell.value}</div>
          </div>
        ))}
      </div>

      {note ? <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary, #475569)' }}>{note}</div> : null}
    </section>
  );
}
