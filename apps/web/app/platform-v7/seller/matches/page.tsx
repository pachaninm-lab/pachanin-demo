import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const BUYER_RATINGS: Record<string, number> = {
  'LOT-2401': 68,
  'LOT-2402': 88,
  'LOT-2403': 92,
  'LOT-2404': 95,
  'LOT-2405': 91,
  'LOT-2406': 73,
};

const MATCH_PRICES: Record<string, string> = {
  'LOT-2401': '14 100 ₽/т',
  'LOT-2402': '12 000 ₽/т',
  'LOT-2403': '13 800 ₽/т',
  'LOT-2404': '33 700 ₽/т',
  'LOT-2405': '13 300 ₽/т',
  'LOT-2406': '13 000 ₽/т',
};

const MATCH_LABELS: Record<string, string> = {
  'LOT-2401': 'Покупатель 3 · Курская обл.',
  'LOT-2402': 'Покупатель 2 · Краснодарский кр.',
  'LOT-2403': 'Покупатель 1 · Воронежская обл.',
  'LOT-2404': 'Покупатель 4 · Липецкая обл.',
  'LOT-2405': 'Покупатель 1 · Воронежская обл.',
  'LOT-2406': 'Покупатель 3 · Курская обл.',
};

const readyLots = lots.filter((l) => l.readiness.state === 'PASS');
const reviewLots = lots.filter((l) => l.readiness.state === 'REVIEW');
const matchedItems = [...readyLots, ...reviewLots].slice(0, 6).map((lot) => ({
  lot,
  buyerLabel: MATCH_LABELS[lot.id] ?? 'Покупатель',
  buyerRating: BUYER_RATINGS[lot.id] ?? 75,
  netPrice: MATCH_PRICES[lot.id] ?? '13 500 ₽/т',
  score: lot.readiness.state === 'PASS' ? 88 + Math.floor(Math.abs((lot.volumeTons % 10) - 5)) : 65 + Math.floor(lot.volumeTons % 20),
})).sort((a, b) => b.score - a.score);

function buyerRatingColor(score: number) {
  if (score >= 85) return { text: green, label: 'Надёжный' };
  if (score >= 70) return { text: amber, label: 'Средний' };
  return { text: red, label: 'Риск' };
}

export default function SellerMatchesPage() {
  const bestMatch = matchedItems[0];

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Подходящие покупатели</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Запросы и покупатели, совпадающие с партиями по культуре, объёму, региону, документам и риску.
            </p>
          </div>
          <Link href='/platform-v7/seller/rfq' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            Все запросы
          </Link>
        </div>
        {bestMatch && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Лучший вариант</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 4 }}>{bestMatch.buyerLabel} · {bestMatch.lot.grain} · {bestMatch.score}% совпадение</div>
            </div>
            <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: green, color: '#fff', fontSize: 12, fontWeight: 800 }}>
              Создать лот
            </Link>
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Совпадения по партиям</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {matchedItems.map(({ lot, buyerLabel, buyerRating, netPrice, score }) => {
            const rc = buyerRatingColor(buyerRating);
            const isReady = lot.readiness.state === 'PASS';
            return (
              <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 80px auto', gap: 12, border: `1px solid ${isReady ? 'rgba(10,122,95,0.16)' : border}`, borderRadius: 14, padding: 14, background: isReady ? 'rgba(10,122,95,0.03)' : '#F8FAFB', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{lot.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{lot.grain} · {lot.volumeTons} т</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{buyerLabel}</div>
                  <div style={{ fontSize: 12, marginTop: 1 }}>
                    Рейтинг: <span style={{ color: rc.text, fontWeight: 700 }}>{rc.label} · {buyerRating}/100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{netPrice}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>чистая цена</div>
                  <div style={{ fontSize: 11, color: green, fontWeight: 700, marginTop: 2 }}>{score}% совп.</div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: isReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${isReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: isReady ? green : amber, fontSize: 11, fontWeight: 900 }}>
                    {isReady ? 'ГОТОВ' : 'REVIEW'}
                  </span>
                </div>
                <Link href={isReady ? '/platform-v7/seller/lots/new' : '/platform-v7/seller/batches'} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: isReady ? green : '#fff', border: `1px solid ${isReady ? green : border}`, color: isReady ? '#fff' : text, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {isReady ? 'Создать лот' : 'Дозагрузить'}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, border: `1px solid ${green}`, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Создать лот
        </Link>
        <Link href='/platform-v7/seller/rfq' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Запросы покупателей
        </Link>
        <Link href='/platform-v7/seller' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит продавца
        </Link>
      </div>
    </div>
  );
}
