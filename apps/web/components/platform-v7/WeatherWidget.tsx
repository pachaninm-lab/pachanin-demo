'use client';

export interface WeatherData {
  city: string;
  tempC: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
  windKmh: number;
  humidityPct: number;
  visibilityKm: number;
  roadAlert?: string;
}

interface Props {
  cities?: WeatherData[];
  compact?: boolean;
}

const readiness = [
  { label: 'Маршрут', value: 'Платформа', note: 'погодный блок должен быть связан с рейсом и контрольными точками' },
  { label: 'Данные', value: 'Интеграция позже', note: 'внешняя погодная интеграция временно не подключена' },
  { label: 'UX', value: 'Доработка', note: 'не показывать температуру, ветер и видимость без источника' },
];

export function WeatherWidget({ compact = false }: Props) {
  return (
    <div style={{ display: 'grid', gap: compact ? '0.375rem' : '0.625rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem' }}>🌤</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>Погода по маршрутам</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>настоящая платформа временно без интеграций</span>
      </div>

      <div style={{ padding: compact ? '0.625rem' : '0.75rem', borderRadius: 12, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)', display: 'grid', gap: '0.5rem' }}>
        <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', lineHeight: 1.5, fontWeight: 650 }}>
          Маршрутные погодные данные не имитируются. После подключения внешнего источника здесь должны отображаться только подтверждённые условия по рейсам, влияющие на исполнение сделки.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.375rem' }}>
          {readiness.map((item) => (
            <div key={item.label} style={{ padding: '0.5rem 0.625rem', borderRadius: 10, background: 'var(--p7-color-surface, #fff)', border: '1px solid var(--p7-color-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 900 }}>{item.label}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: item.value === 'Интеграция позже' ? '#92400E' : '#0A7A5F', fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 2, fontSize: 10, color: 'var(--pc-text-muted)', lineHeight: 1.35 }}>{item.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
