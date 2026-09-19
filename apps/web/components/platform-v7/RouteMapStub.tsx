'use client';

interface RoutePoint {
  id: string;
  label: string;
  sublabel?: string;
  type: 'origin' | 'waypoint' | 'destination' | 'current';
  distanceKm?: number;
  status: 'done' | 'active' | 'pending';
}

interface Props {
  from: string;
  to: string;
  currentKm?: number;
  totalKm?: number;
  waypoints?: { label: string; distanceKm: number }[];
  vehiclePlate?: string;
  eta?: string;
}

export function RouteMapStub({ from, to, currentKm = 0, totalKm = 100, waypoints = [], vehiclePlate, eta }: Props) {
  const progressPct = totalKm > 0 ? Math.min(100, (currentKm / totalKm) * 100) : 0;
  const arrived = progressPct >= 100;

  const points: RoutePoint[] = [
    { id: 'origin', label: from, type: 'origin', distanceKm: 0, status: 'done' },
    ...waypoints.map((wp, i) => ({
      id: `wp-${i}`,
      label: wp.label,
      type: 'waypoint' as const,
      distanceKm: wp.distanceKm,
      status: (currentKm >= wp.distanceKm ? 'done' : 'pending') as RoutePoint['status'],
    })),
    { id: 'destination', label: to, type: 'destination', distanceKm: totalKm, status: arrived ? 'done' : 'pending' },
  ];

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {/* SVG route visualization */}
      <div style={{
        background: 'var(--p7-color-surface-muted)',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid var(--p7-color-border)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid background */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>

        {/* Route line */}
        <div style={{ position: 'relative', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', position: 'relative' }}>
            {/* Progress track */}
            <div style={{
              position: 'absolute',
              left: 0, top: '50%', transform: 'translateY(-50%)',
              width: '100%', height: '4px',
              background: 'var(--p7-color-border)',
              borderRadius: '2px',
            }} />
            <div style={{
              position: 'absolute',
              left: 0, top: '50%', transform: 'translateY(-50%)',
              width: `${progressPct}%`,
              height: '4px',
              background: 'var(--status-active-text, #059669)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />

            {/* Vehicle marker */}
            {!arrived && (
              <div style={{
                position: 'absolute',
                left: `${progressPct}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: 'var(--p7-color-brand, #0A7A5F)',
                border: '3px solid #fff',
                boxShadow: '0 0 0 2px var(--p7-color-brand, #0A7A5F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', zIndex: 2,
              }}>
                🚛
              </div>
            )}

            {/* Points */}
            {points.map((pt, i) => {
              const leftPct = pt.distanceKm !== undefined ? (pt.distanceKm / Math.max(totalKm, 1)) * 100 : (i / (points.length - 1)) * 100;
              const isDone = pt.status === 'done';
              const isActive = pt.type === 'destination' && arrived;

              return (
                <div key={pt.id} style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <div style={{
                    width: pt.type === 'origin' || pt.type === 'destination' ? '18px' : '12px',
                    height: pt.type === 'origin' || pt.type === 'destination' ? '18px' : '12px',
                    borderRadius: '50%',
                    background: isDone || isActive ? 'var(--status-active-text, #059669)' : 'var(--p7-color-surface)',
                    border: `2px solid ${isDone || isActive ? 'var(--status-active-text, #059669)' : 'var(--p7-color-border)'}`,
                    marginBottom: '26px',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isDone ? 'var(--status-active-text)' : 'var(--pc-text-muted)',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {pt.label}
                    {pt.distanceKm !== undefined && pt.distanceKm > 0 && (
                      <div style={{ fontSize: '9px', opacity: 0.7 }}>{pt.distanceKm} км</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: '52px' }} />
        </div>

        {/* Yandex Maps note */}
        <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
          Схема маршрута · Яндекс.Карты API подключается при выходе из демо-режима
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
        <StatCell label="Пройдено" value={`${currentKm} км`} />
        <StatCell label="Осталось" value={arrived ? 'Прибыл' : `${totalKm - currentKm} км`} />
        {eta && <StatCell label="Прибытие" value={arrived ? '—' : eta} />}
        {vehiclePlate && <StatCell label="Номер ТС" value={vehiclePlate} mono />}
      </div>
    </div>
  );
}

function StatCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      padding: '0.625rem',
      borderRadius: '8px',
      background: 'var(--p7-color-surface-muted)',
      border: '1px solid var(--p7-color-border)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>{value}</div>
    </div>
  );
}
