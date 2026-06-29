'use client';

import Link from 'next/link';
import { RouteMapStub } from '@/components/platform-v7/RouteMapStub';

interface RouteData {
  id: string;
  from: string;
  to: string;
  status: string;
  driver: string;
  plate: string;
  eta: string;
  dealId: string;
  cargo: string;
  km: number;
  totalKm: number;
  vehicleType: string;
  weightTons: number;
  ttnNumber: string;
  loadedAt: string;
  seals: string[];
  waypoints: { label: string; distanceKm: number }[];
  acts: { id: string; type: string; status: string; date: string }[];
}

const ROUTES: Record<string, RouteData> = {
  'ТМБ-14': {
    id: 'ТМБ-14', from: 'Тамбов', to: 'Воронеж', status: 'В пути',
    driver: 'Иванов С.П.', plate: 'А234-ВС-68', eta: '14:30',
    dealId: 'DL-9102', cargo: 'Пшеница 4 кл.', km: 142, totalKm: 142,
    vehicleType: 'Зерновоз КАМАЗ-6520', weightTons: 120,
    ttnNumber: 'ЭТрН-2024-003451',
    loadedAt: '2024-03-01T08:00:00Z',
    seals: ['СП-0012341', 'СП-0012342'],
    waypoints: [{ label: 'Пост ДПС Тамбов', distanceKm: 18 }, { label: 'Рамонь', distanceKm: 110 }],
    acts: [
      { id: 'АКТ-001', type: 'Акт погрузки', status: 'Подписан', date: '2024-03-01' },
      { id: 'ЭТрН-003451', type: 'ЭТрН / ГИС ЭПД', status: 'Ожидает подписи', date: '2024-03-01' },
    ],
  },
  'ВРЖ-08': {
    id: 'ВРЖ-08', from: 'Воронеж', to: 'Липецк', status: 'Прибыл',
    driver: 'Петров А.Н.', plate: 'В567-ДЕ-36', eta: '—',
    dealId: 'DL-9105', cargo: 'Ячмень 2 кл.', km: 0, totalKm: 156,
    vehicleType: 'Зерновоз МАЗ-6501', weightTons: 85,
    ttnNumber: 'ЭТрН-2024-003389',
    loadedAt: '2024-02-28T07:30:00Z',
    seals: ['СП-0011987'],
    waypoints: [{ label: 'Задонск', distanceKm: 70 }],
    acts: [
      { id: 'АКТ-002', type: 'Акт погрузки', status: 'Подписан', date: '2024-02-28' },
      { id: 'АКТ-003', type: 'Акт приёмки', status: 'Подписан', date: '2024-02-28' },
      { id: 'ЭТрН-003389', type: 'ЭТрН / ГИС ЭПД', status: 'Закрыт', date: '2024-02-28' },
    ],
  },
  'КРС-03': {
    id: 'КРС-03', from: 'Курск', to: 'Тамбов', status: 'Погрузка',
    driver: 'Сидоров В.К.', plate: 'Е890-ЖЗ-46', eta: '18:00',
    dealId: 'DL-9108', cargo: 'Подсолнечник', km: 0, totalKm: 218,
    vehicleType: 'Зерновоз Scania R450', weightTons: 200,
    ttnNumber: 'ЭТрН-2024-003512',
    loadedAt: '2024-03-02T06:00:00Z',
    seals: [],
    waypoints: [{ label: 'Льгов', distanceKm: 45 }, { label: 'Железногорск', distanceKm: 95 }],
    acts: [
      { id: 'АКТ-004', type: 'Акт погрузки', status: 'Ожидает подписи', date: '2024-03-02' },
    ],
  },
};

const STATUS_PALETTE: Record<string, { bg: string; border: string; color: string }> = {
  'В пути':   { bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.18)',   color: '#2563EB' },
  'Прибыл':   { bg: 'rgba(10,122,95,0.08)',   border: 'rgba(10,122,95,0.18)',   color: '#0A7A5F' },
  'Погрузка': { bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.18)',   color: '#B45309' },
  'Ожидание': { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.18)', color: '#4B5563' },
};

const ACT_STATUS_COLOR: Record<string, string> = {
  'Подписан': 'var(--status-active-text, #059669)',
  'Закрыт': 'var(--status-active-text, #059669)',
  'Ожидает подписи': 'var(--status-warning-text, #D97706)',
};

export default function RouteDetailPage({ params }: { params: { routeId: string } }) {
  const route = ROUTES[decodeURIComponent(params.routeId)];

  if (!route) {
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 800, margin: '0 auto' }}>
        <section style={card}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Маршрут {params.routeId}</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 8 }}>Данные по маршруту не найдены.</div>
          <Link href='/platform-v7/logistics' style={ghostBtn}>← Все маршруты</Link>
        </section>
      </div>
    );
  }

  const pal = STATUS_PALETTE[route.status] ?? STATUS_PALETTE['Ожидание'];
  const progressKm = route.status === 'Прибыл' ? route.totalKm : route.status === 'Погрузка' ? 0 : route.km;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860, margin: '0 auto', padding: '4px 0 24px' }}>

      {/* Header */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--p7-color-brand, #0A7A5F)', fontSize: 13 }}>{route.id}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6, lineHeight: 1.1 }}>
              {route.from} → {route.to}
            </div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>
              {route.cargo} · {route.weightTons} т · {route.vehicleType}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '6px 14px',
            borderRadius: 999, background: pal.bg, border: `1px solid ${pal.border}`,
            color: pal.color, fontSize: 12, fontWeight: 800,
          }}>{route.status}</span>
        </div>
      </section>

      {/* Map */}
      <section style={{ ...card, gap: 12 }}>
        <div style={sectionLabel}>Маршрут на карте</div>
        <RouteMapStub
          from={route.from}
          to={route.to}
          currentKm={progressKm}
          totalKm={route.totalKm}
          eta={route.eta !== '—' ? route.eta : undefined}
          vehiclePlate={route.plate}
          waypoints={route.waypoints}
        />
      </section>

      {/* Driver + Vehicle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <section style={{ ...card, gap: 10 }}>
          <div style={sectionLabel}>Водитель</div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <InfoRow label="ФИО" value={route.driver} />
            <InfoRow label="Номер ТС" value={route.plate} mono />
            <InfoRow label="Тип ТС" value={route.vehicleType} />
            <InfoRow label="Загружено" value={new Date(route.loadedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })} />
          </div>
        </section>

        <section style={{ ...card, gap: 10 }}>
          <div style={sectionLabel}>Пломбы и охрана</div>
          {route.seals.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.375rem' }}>
              {route.seals.map((seal) => (
                <div key={seal} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem' }}>🔒</span>
                  <span className="mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{seal}</span>
                  <span style={{ fontSize: '10px', color: 'var(--status-active-text)' }}>✓ Установлена</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning-text)' }}>⚠ Пломбы ещё не установлены</div>
          )}
          <div style={{ marginTop: '0.5rem' }}>
            <InfoRow label="Прибытие (ETA)" value={route.eta} />
          </div>
        </section>
      </div>

      {/* ТТН / ЭТрН */}
      <section style={{ ...card, gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={sectionLabel}>Документы рейса (ЭТрН)</div>
          <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--p7-color-brand)', fontWeight: 700 }}>{route.ttnNumber}</span>
        </div>
        <div style={{ display: 'grid', gap: '0.375rem' }}>
          {route.acts.map((act) => (
            <div key={act.id} style={{
              display: 'flex', gap: '0.75rem', alignItems: 'center',
              padding: '0.625rem 0.875rem', borderRadius: '10px',
              background: 'var(--p7-color-surface-muted, rgba(255,255,255,0.03))',
              border: '1px solid var(--p7-color-border, rgba(255,255,255,0.08))',
              flexWrap: 'wrap',
            }}>
              <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--p7-color-brand)', fontWeight: 700, minWidth: '6rem' }}>{act.id}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--pc-text-primary)' }}>{act.type}</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: ACT_STATUS_COLOR[act.status] ?? 'var(--pc-text-muted)' }}>
                {act.status}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', flexShrink: 0 }}>{act.date}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${route.dealId}/clean`} style={primaryBtn}>
          Открыть сделку {route.dealId}
        </Link>
        <Link href='/platform-v7/logistics' style={ghostBtn}>← Все маршруты</Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
      <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value}</span>
    </div>
  );
}

const card = {
  background: 'var(--p7-color-surface, #0E1A18)',
  border: '1px solid var(--p7-color-border, #24342F)',
  borderRadius: 16,
  padding: 18,
  display: 'grid',
  gap: 12,
} as const;

const sectionLabel = {
  fontSize: '10px',
  color: 'var(--pc-text-muted)',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
};

const primaryBtn = {
  textDecoration: 'none',
  padding: '10px 16px',
  borderRadius: 12,
  background: 'var(--p7-color-brand, #0A7A5F)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  minHeight: '44px',
  display: 'inline-flex',
  alignItems: 'center',
} as const;

const ghostBtn = {
  textDecoration: 'none',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--p7-color-border, #24342F)',
  background: 'transparent',
  color: 'var(--pc-text-muted)',
  fontSize: 13,
  fontWeight: 700,
  minHeight: '44px',
  display: 'inline-flex',
  alignItems: 'center',
} as const;
