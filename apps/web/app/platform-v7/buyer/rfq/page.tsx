import Link from 'next/link';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

type RfqStatus = 'active' | 'matched' | 'expired' | 'cancelled';

interface BuyerRfq {
  id: string;
  grain: string;
  cropClass: string;
  volumeTons: number;
  region: string;
  maxPrice: string;
  basis: string;
  status: RfqStatus;
  matchCount: number;
  createdAt: string;
  expiresIn: string | null;
}

const MY_RFQS: BuyerRfq[] = [
  {
    id: 'RFQ-B-2401',
    grain: 'Пшеница',
    cropClass: '4 кл.',
    volumeTons: 400,
    region: 'ЦФО',
    maxPrice: '16 200 ₽/т',
    basis: 'EXW',
    status: 'matched',
    matchCount: 3,
    createdAt: '08.06.2026',
    expiresIn: '5 дней',
  },
  {
    id: 'RFQ-B-2402',
    grain: 'Ячмень',
    cropClass: '2 кл.',
    volumeTons: 200,
    region: 'ЮФО',
    maxPrice: '12 500 ₽/т',
    basis: 'CPT',
    status: 'active',
    matchCount: 1,
    createdAt: '07.06.2026',
    expiresIn: '8 дней',
  },
  {
    id: 'RFQ-B-2403',
    grain: 'Подсолнечник',
    cropClass: '',
    volumeTons: 500,
    region: 'ЦФО',
    maxPrice: '34 000 ₽/т',
    basis: 'FCA',
    status: 'active',
    matchCount: 0,
    createdAt: '06.06.2026',
    expiresIn: '12 дней',
  },
  {
    id: 'RFQ-B-2398',
    grain: 'Кукуруза',
    cropClass: '3 кл.',
    volumeTons: 300,
    region: 'ЮФО',
    maxPrice: '13 200 ₽/т',
    basis: 'DAP',
    status: 'expired',
    matchCount: 0,
    createdAt: '20.05.2026',
    expiresIn: null,
  },
];

const statusStyle: Record<RfqStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  active: { label: 'АКТИВЕН', color: blue, bg: 'rgba(37,99,235,0.07)', borderColor: 'rgba(37,99,235,0.18)' },
  matched: { label: 'ЕСТЬ СОВПАДЕНИЯ', color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  expired: { label: 'ИСТЁК', color: muted, bg: 'rgba(107,114,128,0.07)', borderColor: 'rgba(107,114,128,0.18)' },
  cancelled: { label: 'ОТМЕНЁН', color: red, bg: 'rgba(220,38,38,0.07)', borderColor: 'rgba(220,38,38,0.18)' },
};

export default function PlatformV7BuyerRfqPage() {
  const active = MY_RFQS.filter((r) => r.status === 'active' || r.status === 'matched');

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Мои запросы</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Закупочные запросы, их статус, совпадения с партиями продавцов и переход к офферу.
            </p>
          </div>
          <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            + Новый запрос
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего', value: String(MY_RFQS.length), color: text },
            { label: 'Активных', value: String(active.length), color: blue },
            { label: 'С совпадениями', value: String(MY_RFQS.filter((r) => r.matchCount > 0).length), color: green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Запросы</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {MY_RFQS.map((rfq) => {
            const ss = statusStyle[rfq.status];
            const isActive = rfq.status === 'active' || rfq.status === 'matched';
            return (
              <div key={rfq.id} style={{ display: 'grid', gap: 10, border: `1px solid ${rfq.status === 'matched' ? 'rgba(10,122,95,0.18)' : border}`, borderRadius: 14, padding: 14, background: rfq.status === 'matched' ? 'rgba(10,122,95,0.03)' : '#F8FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: blue }}>{rfq.id}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: text, marginTop: 3 }}>{rfq.grain} {rfq.cropClass} · {rfq.volumeTons} т</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{rfq.region} · {rfq.basis} · до {rfq.maxPrice}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Создан: {rfq.createdAt}{rfq.expiresIn ? ` · Действует: ${rfq.expiresIn}` : ''}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: ss.bg, border: `1px solid ${ss.borderColor}`, color: ss.color, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {ss.label}
                  </span>
                </div>
                {rfq.matchCount > 0 && (
                  <div style={{ fontSize: 12, color: green, fontWeight: 700 }}>
                    Найдено совпадений: {rfq.matchCount}
                  </div>
                )}
                {isActive && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: rfq.matchCount > 0 ? green : '#fff', border: `1px solid ${rfq.matchCount > 0 ? green : border}`, color: rfq.matchCount > 0 ? '#fff' : text, fontSize: 12, fontWeight: 800 }}>
                      {rfq.matchCount > 0 ? `Смотреть совпадения (${rfq.matchCount})` : 'Ожидание совпадений'}
                    </Link>
                    <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: muted, fontSize: 12, fontWeight: 700 }}>
                      Изменить
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Новый запрос
        </Link>
        <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Подбор партий
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
