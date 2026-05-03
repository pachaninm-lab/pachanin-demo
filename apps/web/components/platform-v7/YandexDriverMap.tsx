'use client';

import type { ExecutionRoutePoint } from '@/lib/platform-v7/domain/execution-simulation';

function buildYandexMapUrl(points: ExecutionRoutePoint[]) {
  const origin = points.find((point) => point.kind === 'origin') ?? points[0];
  const destination = points.find((point) => point.kind === 'destination') ?? points[points.length - 1];
  const current = points.find((point) => point.kind === 'current') ?? origin;
  const ll = `${current.lng},${current.lat}`;
  const rtext = `${origin.lat},${origin.lng}~${destination.lat},${destination.lng}`;

  return `https://yandex.ru/map-widget/v1/?ll=${encodeURIComponent(ll)}&z=9&mode=routes&rtext=${encodeURIComponent(rtext)}&rtt=auto`;
}

export function YandexDriverMap({ points, progress, title, subtitle }: { points: ExecutionRoutePoint[]; progress: number; title: string; subtitle: string }) {
  const current = points.find((point) => point.kind === 'current') ?? points[0];
  const url = buildYandexMapUrl(points);
  const safeProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Яндекс Карта рейса</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{title} · {subtitle}</p>
        </div>
        <span style={{ borderRadius: 999, padding: '5px 9px', background: 'rgba(37,99,235,.08)', color: '#1D4ED8', fontSize: 12, fontWeight: 900 }}>маркер водителя {safeProgress}%</span>
      </div>

      <div style={{ position: 'relative', minHeight: 360, border: '1px solid var(--pc-border)', borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(135deg,rgba(15,23,42,.06),rgba(37,99,235,.08))' }}>
        <iframe
          title="Яндекс Карта · маршрут водителя"
          src={url}
          width="100%"
          height="360"
          frameBorder="0"
          style={{ display: 'block', width: '100%', height: 360, filter: 'saturate(.92) contrast(.98)', border: 0 }}
          loading="lazy"
        />
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0) 35%,rgba(15,23,42,.08))' }} />
        <div style={{ position: 'absolute', left: `calc(22px + ${safeProgress}% * (100% - 64px) / 100)`, top: '48%', transform: 'translate(-50%,-50%)', display: 'grid', justifyItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: '#0A7A5F', border: '3px solid white', boxShadow: '0 10px 30px rgba(15,23,42,.25)' }} />
          <div style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(15,23,42,.86)', color: 'white', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>Водитель · {current.label}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        {points.map((point) => (
          <div key={point.label} style={{ border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12, background: point.kind === 'current' ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)' }}>
            <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{point.kind === 'origin' ? 'старт' : point.kind === 'destination' ? 'финиш' : point.kind === 'current' ? 'текущее' : 'контроль'}</div>
            <div style={{ marginTop: 5, fontWeight: 900 }}>{point.label}</div>
            <div style={{ marginTop: 3, color: 'var(--pc-text-secondary)', fontSize: 12 }}>{point.lat.toFixed(3)}, {point.lng.toFixed(3)}</div>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, color: 'var(--pc-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
        Карта работает как пилотная симуляция: маршрут и маркер формируются из данных сделки. Для боевого режима нужны ключ Яндекс.Карт, договор, политика обработки геоданных и серверное хранение событий рейса.
      </p>
    </div>
  );
}
