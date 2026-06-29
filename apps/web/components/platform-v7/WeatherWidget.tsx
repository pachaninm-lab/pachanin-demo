'use client';

import { useEffect, useState } from 'react';

export interface WeatherData {
  city: string;
  tempC: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
  windKmh: number;
  humidityPct: number;
  visibilityKm: number;
  roadAlert?: string;
}

const CONDITION_ICON: Record<WeatherData['condition'], string> = {
  clear: '☀️', cloudy: '⛅', rain: '🌧️', snow: '❄️', fog: '🌫️', storm: '⛈️',
};

const CONDITION_LABEL: Record<WeatherData['condition'], string> = {
  clear: 'Ясно', cloudy: 'Облачно', rain: 'Дождь', snow: 'Снег', fog: 'Туман', storm: 'Гроза',
};

const CONDITION_ALERT: Partial<Record<WeatherData['condition'], string>> = {
  snow: 'Возможны снежные заносы — водители сообщают о сложных участках',
  fog: 'Туман снижает видимость — осторожно на трассах',
  storm: 'Грозовое предупреждение — рекомендуется отложить рейсы',
};

const DEMO_CITIES: WeatherData[] = [
  { city: 'Тамбов', tempC: 14, condition: 'cloudy', windKmh: 18, humidityPct: 68, visibilityKm: 10 },
  { city: 'Воронеж', tempC: 16, condition: 'clear', windKmh: 12, humidityPct: 55, visibilityKm: 15 },
  { city: 'Курск', tempC: 11, condition: 'rain', windKmh: 25, humidityPct: 82, visibilityKm: 6, roadAlert: 'Мокрое покрытие на М2 — снизить скорость' },
  { city: 'Липецк', tempC: 13, condition: 'cloudy', windKmh: 16, humidityPct: 70, visibilityKm: 9 },
];

function getRoadRiskLevel(w: WeatherData): 'ok' | 'warn' | 'danger' {
  if (w.condition === 'storm' || w.condition === 'snow') return 'danger';
  if (w.condition === 'rain' || w.condition === 'fog' || w.windKmh > 40 || w.visibilityKm < 5) return 'warn';
  return 'ok';
}

const RISK_COLOR = {
  ok: 'var(--status-active-text, #059669)',
  warn: 'var(--status-warning-text, #D97706)',
  danger: 'var(--status-error-text, #DC2626)',
};

const RISK_LABEL = { ok: 'Нормальные условия', warn: 'Повышенная осторожность', danger: 'Опасные условия' };

interface Props {
  cities?: WeatherData[];
  compact?: boolean;
}

export function WeatherWidget({ cities = DEMO_CITIES, compact = false }: Props) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const hasAlerts = cities.some((w) => getRoadRiskLevel(w) !== 'ok');

  return (
    <div style={{ display: 'grid', gap: '0.625rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem' }}>🌤</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>Погода по маршрутам</span>
          {hasAlerts && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--status-warning-text, #D97706)', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '999px', padding: '1px 8px' }}>
              Предупреждения
            </span>
          )}
        </div>
        {time && <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>Актуально на {time} · демо-данные</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.375rem' }}>
        {cities.map((w) => {
          const risk = getRoadRiskLevel(w);
          const alert = w.roadAlert ?? CONDITION_ALERT[w.condition];
          return (
            <div key={w.city} style={{
              padding: '0.625rem 0.75rem', borderRadius: '10px',
              background: risk === 'danger' ? 'rgba(220,38,38,0.06)' : risk === 'warn' ? 'rgba(217,119,6,0.06)' : 'var(--p7-color-surface-muted)',
              border: `1px solid ${risk === 'danger' ? 'rgba(220,38,38,0.2)' : risk === 'warn' ? 'rgba(217,119,6,0.2)' : 'var(--p7-color-border)'}`,
              display: 'grid', gap: '0.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--p7-color-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.city}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginTop: '2px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--pc-text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{w.tempC}°</span>
                    <span style={{ fontSize: '1rem' }}>{CONDITION_ICON[w.condition]}</span>
                  </div>
                </div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: RISK_COLOR[risk], textAlign: 'right', marginTop: '2px' }}>
                  {risk !== 'ok' ? '⚠' : '✓'} {compact ? '' : RISK_LABEL[risk]}
                </div>
              </div>

              {!compact && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>💨 {w.windKmh} км/ч</div>
                  <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>👁 {w.visibilityKm} км</div>
                  <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>💧 {w.humidityPct}%</div>
                  <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>{CONDITION_LABEL[w.condition]}</div>
                </div>
              )}

              {alert && !compact && (
                <div style={{ fontSize: '9px', color: risk === 'danger' ? '#DC2626' : '#B45309', lineHeight: 1.4, marginTop: '0.25rem', fontWeight: 600 }}>
                  {alert}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
