'use client';

import Link from 'next/link';

const ROUTES: Record<string, { id: string; from: string; to: string; status: string; driver: string; plate: string; eta: string; dealId: string; cargo: string; km: number }> = {
  'ТМБ-14': { id: 'ТМБ-14', from: 'Тамбов', to: 'Воронеж',    status: 'В пути',     driver: 'Иванов С.П.',   plate: 'А234ВС68', eta: '14:30', dealId: 'DL-9102', cargo: 'Пшеница 4 кл.',    km: 142 },
  'ВРЖ-08': { id: 'ВРЖ-08', from: 'Воронеж', to: 'Липецк',    status: 'Прибыл',     driver: 'Петров А.Н.',   plate: 'В567ДЕ36', eta: '—',     dealId: 'DL-9105', cargo: 'Ячмень 2 кл.',     km: 0   },
  'КРС-03': { id: 'КРС-03', from: 'Курск',   to: 'Тамбов',    status: 'Погрузка',   driver: 'Сидоров В.К.',  plate: 'Е890ЖЗ46', eta: '18:00', dealId: 'DL-9108', cargo: 'Подсолнечник',     km: 218 },
  'ВРЖ-12': { id: 'ВРЖ-12', from: 'Воронеж', to: 'Ростов',    status: 'В пути',     driver: 'Козлов М.И.',   plate: 'З123ИК36', eta: '21:45', dealId: 'DL-9110', cargo: 'Кукуруза 3 кл.',   km: 389 },
  'КРС-09': { id: 'КРС-09', from: 'Курск',   to: 'Краснодар', status: 'Ожидание',   driver: 'Новиков Д.С.',  plate: 'И456КЛ46', eta: '09:00', dealId: 'DL-9112', cargo: 'Рапс',             km: 547 },
  'БЛГ-15': { id: 'БЛГ-15', from: 'Белгород', to: 'Воронеж',  status: 'Прибыл',     driver: 'Морозов Г.П.',  plate: 'К789ЛМ31', eta: '—',     dealId: 'DL-9115', cargo: 'Пшеница 3 кл.',    km: 0   },
  'СТВ-21': { id: 'СТВ-21', from: 'Ставрополь', to: 'Ростов', status: 'В пути',     driver: 'Волков Р.А.',   plate: 'Л012МН26', eta: '16:15', dealId: 'DL-9117', cargo: 'Соя',              km: 193 },
};

const STATUS_PALETTE: Record<string, { bg: string; border: string; color: string }> = {
  'В пути':   { bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.18)',   color: '#2563EB' },
  'Прибыл':   { bg: 'rgba(10,122,95,0.08)',   border: 'rgba(10,122,95,0.18)',   color: '#0A7A5F' },
  'Погрузка': { bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.18)',   color: '#B45309' },
  'Ожидание': { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.18)', color: '#4B5563' },
};

export default function RouteDetailPage({ params }: { params: { routeId: string } }) {
  const route = ROUTES[decodeURIComponent(params.routeId)];

  if (!route) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Маршрут {params.routeId}</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 8 }}>Данные по маршруту не найдены.</div>
          <Link href='/platform-v7/logistics' style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все маршруты</Link>
        </section>
      </div>
    );
  }

  const pal = STATUS_PALETTE[route.status] ?? STATUS_PALETTE['Ожидание'];

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 800, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>{route.id}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{route.from} → {route.to}</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>{route.cargo} · {route.driver} · {route.plate}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: pal.bg, border: `1px solid ${pal.border}`, color: pal.color, fontSize: 12, fontWeight: 800 }}>{route.status}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'ETA',       value: route.eta    },
          { label: 'Осталось',  value: route.km > 0 ? `${route.km} км` : 'Прибыл' },
          { label: 'Сделка',    value: route.dealId },
          { label: 'Водитель',  value: route.driver },
        ].map(({ label, value }) => (
          <section key={label} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{value}</div>
          </section>
        ))}
      </div>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Хроника</div>
        {[
          { time: '08:00', event: 'Погрузка завершена, машина выехала' },
          { time: '09:30', event: 'Рейс зарегистрирован в ФГИС' },
          { time: '11:15', event: `В пути · GPS: ${route.from} — ${route.to}` },
          route.status === 'Прибыл' ? { time: '13:45', event: 'Прибытие на элеватор подтверждено' } : null,
        ].filter(Boolean).map((ev, i) => ev && (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--pc-text-muted)', whiteSpace: 'nowrap', marginTop: 2 }}>{ev.time}</span>
            <span style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{ev.event}</span>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${route.dealId}`} style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 12, background: 'var(--pc-accent)', border: '1px solid var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800 }}>Открыть сделку {route.dealId}</Link>
        <Link href='/platform-v7/logistics' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все маршруты</Link>
      </div>
    </div>
  );
}
