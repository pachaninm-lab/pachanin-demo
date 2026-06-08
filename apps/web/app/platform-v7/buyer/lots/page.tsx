import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const SELLER_RATINGS: Record<string, number> = {
  'LOT-2401': 74,
  'LOT-2402': 82,
  'LOT-2403': 91,
  'LOT-2404': 95,
  'LOT-2405': 88,
  'LOT-2406': 79,
  'LOT-2407': 67,
  'LOT-2408': 93,
};

const MOCK_PRICES: Record<string, string> = {
  'LOT-2401': '14 200 ₽/т',
  'LOT-2402': '11 800 ₽/т',
  'LOT-2403': '13 600 ₽/т',
  'LOT-2404': '33 500 ₽/т',
  'LOT-2405': '13 100 ₽/т',
  'LOT-2406': '12 900 ₽/т',
  'LOT-2407': '13 400 ₽/т',
  'LOT-2408': '14 500 ₽/т',
};

function ratingColor(score: number) {
  if (score >= 85) return { text: green, label: 'Высокий' };
  if (score >= 70) return { text: amber, label: 'Средний' };
  return { text: red, label: 'Требует проверки' };
}

const availableLots = lots.filter((l) => l.readiness.state === 'PASS' || l.readiness.state === 'REVIEW');

export default function BuyerLotsPage() {
  const readyCount = availableLots.filter((l) => l.readiness.state === 'PASS').length;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Доступные лоты</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Рыночные лоты с ценой, объёмом, рейтингом продавца и документальным статусом.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '9px 13px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
              Новый запрос
            </Link>
            <Link href='/platform-v7/lots' style={{ textDecoration: 'none', padding: '9px 13px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
              Все лоты
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Доступных', value: String(availableLots.length), color: blue },
            { label: 'Готовых к предложению', value: String(readyCount), color: green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Лоты на рынке</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {availableLots.map((lot) => {
            const sellerRating = SELLER_RATINGS[lot.id] ?? 75;
            const rc = ratingColor(sellerRating);
            const isReady = lot.readiness.state === 'PASS';
            const price = MOCK_PRICES[lot.id] ?? '— ₽/т';
            return (
              <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 80px auto', gap: 12, border: `1px solid ${isReady ? 'rgba(10,122,95,0.18)' : border}`, borderRadius: 14, padding: 14, background: isReady ? 'rgba(10,122,95,0.03)' : '#F8FAFB', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: blue }}>{lot.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{lot.grain}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{lot.volumeTons} т</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 1 }}>
                    Рейтинг продавца: <span style={{ color: rc.text, fontWeight: 700 }}>{sellerRating}/100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{price}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{lot.sourceType === 'FGIS' ? 'ФГИС' : 'РУЧНОЙ'}</div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: isReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${isReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: isReady ? green : amber, fontSize: 11, fontWeight: 900 }}>
                    {isReady ? 'ГОТОВ' : 'REVIEW'}
                  </span>
                </div>
                <Link href='/platform-v7/buyer/offers' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: isReady ? blue : '#fff', border: `1px solid ${isReady ? blue : border}`, color: isReady ? '#fff' : text, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {isReady ? 'Предложение' : 'Смотреть'}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, border: `1px solid ${blue}`, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Создать запрос
        </Link>
        <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Подбор под мой запрос
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
