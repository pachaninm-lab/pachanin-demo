'use client';

import Link from 'next/link';

const ROUTES = [
  { id: 'ТМБ-14', status: 'В пути', eta: '14:28', deal: 'DL-9101', origin: 'Тамбов', dest: 'Воронеж', driver: 'Иванов А.', deviation: null },
  { id: 'ВРЖ-08', status: 'Прибыл', eta: null, deal: 'DL-9102', origin: 'Воронеж', dest: 'Курск', driver: 'Петров С.', deviation: null },
  { id: 'КРС-03', status: 'Ожидает отгрузки', eta: '16:00', deal: 'DL-9103', origin: 'Курск', dest: 'Белгород', driver: 'Сидоров В.', deviation: 'Вес −1.2т' },
  { id: 'ВРЖ-12', status: 'В пути', eta: '18:45', deal: 'DL-9104', origin: 'Воронеж', dest: 'Ростов', driver: 'Козлов М.', deviation: null },
  { id: 'КРС-09', status: 'Приёмка', eta: null, deal: 'DL-9105', origin: 'Курск', dest: 'Ставрополь', driver: 'Новиков Д.', deviation: null },
  { id: 'БЛГ-15', status: 'В пути', eta: '20:10', deal: 'DL-9106', origin: 'Белгород', dest: 'Тамбов', driver: 'Алексеев П.', deviation: null },
  { id: 'СТВ-21', status: 'Завершён', eta: null, deal: 'DL-9107', origin: 'Ставрополь', dest: 'Ростов', driver: 'Морозов И.', deviation: null },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'В пути':            { bg: 'rgba(37,99,235,0.08)',  color: '#2563EB',  border: 'rgba(37,99,235,0.18)' },
  'Прибыл':            { bg: 'rgba(10,122,95,0.08)',  color: '#0A7A5F',  border: 'rgba(10,122,95,0.18)' },
  'Ожидает отгрузки':  { bg: 'rgba(217,119,6,0.08)',  color: '#B45309',  border: 'rgba(217,119,6,0.18)' },
  'Приёмка':           { bg: 'rgba(147,51,234,0.08)', color: '#7E22CE',  border: 'rgba(147,51,234,0.18)' },
  'Завершён':          { bg: 'rgba(107,114,128,0.08)', color: '#4B5563', border: 'rgba(107,114,128,0.18)' },
};

export default function LogisticsPage() {
  const inTransit = ROUTES.filter(r => r.status === 'В пути').length;
  const awaitingAcceptance = ROUTES.filter(r => r.status === 'Прибыл' || r.status === 'Приёмка').length;
  const deviations = ROUTES.filter(r => r.deviation).length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>
          Диспетчерская
        </h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4, paddingLeft: 16 }}>
          Активные рейсы и контроль доставки
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Машины в рейсе', value: String(inTransit), color: '#2563EB' },
          { label: 'Ожидают приёмку', value: String(awaitingAcceptance), color: '#0A7A5F' },
          { label: 'Отклонения', value: String(deviations), color: deviations > 0 ? '#B45309' : '#0A7A5F' },
          { label: 'Рейсов всего', value: String(ROUTES.length), color: '#0F1419' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Активные рейсы</div>
        </div>
        <div style={{ display: 'grid', gap: 0 }}>
          {ROUTES.map((route, i) => {
            const sc = STATUS_COLORS[route.status] ?? { bg: '#F8FAFB', color: '#6B778C', border: '#E4E6EA' };
            return (
              <Link
                key={route.id}
                href={`/platform-v7/logistics/${route.id}`}
                style={{
                  textDecoration: 'none',
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderBottom: i < ROUTES.length - 1 ? '1px solid #F1F3F5' : 'none',
                  background: 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 14, color: '#0F1419' }}>{route.id}</div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>{route.deal}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 600 }}>{route.origin} → {route.dest}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>
                    {route.driver}{route.deviation ? ` · ⚠️ ${route.deviation}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {route.status}
                  </span>
                  {route.eta ? <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>ETA {route.eta}</div> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
