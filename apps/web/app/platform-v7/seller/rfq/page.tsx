import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const blue = '#2563EB';

type MatchLevel = 'strong' | 'possible' | 'clarify';

interface BuyerRfq {
  id: string;
  buyerAlias: string;
  buyerRating: number;
  grain: string;
  volumeTons: number;
  region: string;
  pricePerTon: string;
  basis: string;
  daysLeft: number;
  matchLevel: MatchLevel;
  matchLotId: string;
  missingItems?: string[];
}

const BUYER_RFQS: BuyerRfq[] = [
  {
    id: 'RFQ-2401',
    buyerAlias: 'Покупатель 1 · Воронежская обл.',
    buyerRating: 92,
    grain: 'Пшеница 4 кл.',
    volumeTons: 400,
    region: 'ЦФО',
    pricePerTon: '15 900 ₽/т',
    basis: 'EXW элеватор',
    daysLeft: 5,
    matchLevel: 'strong',
    matchLotId: 'LOT-2403',
  },
  {
    id: 'RFQ-2402',
    buyerAlias: 'Покупатель 2 · Краснодарский кр.',
    buyerRating: 88,
    grain: 'Ячмень',
    volumeTons: 200,
    region: 'ЮФО',
    pricePerTon: '12 100 ₽/т',
    basis: 'CPT покупатель',
    daysLeft: 8,
    matchLevel: 'strong',
    matchLotId: 'LOT-2401',
  },
  {
    id: 'RFQ-2403',
    buyerAlias: 'Покупатель 3 · Курская обл.',
    buyerRating: 74,
    grain: 'Пшеница 3 кл.',
    volumeTons: 600,
    region: 'ЦФО',
    pricePerTon: '16 200 ₽/т',
    basis: 'FCA',
    daysLeft: 3,
    matchLevel: 'possible',
    matchLotId: 'LOT-2406',
    missingItems: ['Нет протокола качества'],
  },
  {
    id: 'RFQ-2404',
    buyerAlias: 'Покупатель 4 · Липецкая обл.',
    buyerRating: 95,
    grain: 'Подсолнечник',
    volumeTons: 500,
    region: 'ЦФО',
    pricePerTon: '33 500 ₽/т',
    basis: 'EXW',
    daysLeft: 12,
    matchLevel: 'strong',
    matchLotId: 'LOT-2404',
  },
  {
    id: 'RFQ-2405',
    buyerAlias: 'Покупатель 5 · Ростовская обл.',
    buyerRating: 65,
    grain: 'Кукуруза',
    volumeTons: 300,
    region: 'ЮФО',
    pricePerTon: '13 000 ₽/т',
    basis: 'DAP',
    daysLeft: 7,
    matchLevel: 'clarify',
    matchLotId: 'LOT-2402',
    missingItems: ['Нет СДИЗ', 'Объём не совпадает'],
  },
];

const matchStyle: Record<MatchLevel, { label: string; color: string; bg: string; borderColor: string }> = {
  strong: { label: 'СИЛЬНОЕ СОВПАДЕНИЕ', color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  possible: { label: 'ВОЗМОЖНОЕ', color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)' },
  clarify: { label: 'УТОЧНИТЬ', color: '#6B778C', bg: 'rgba(107,114,128,0.07)', borderColor: 'rgba(107,114,128,0.18)' },
};

function ratingColor(score: number) {
  if (score >= 85) return green;
  if (score >= 70) return amber;
  return '#B91C1C';
}

const readyLots = lots.filter((l) => l.readiness.state === 'PASS');

export default function SellerRfqPage() {
  const strongMatches = BUYER_RFQS.filter((r) => r.matchLevel === 'strong');
  const bestRfq = BUYER_RFQS.sort((a, b) => b.buyerRating - a.buyerRating)[0];

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Запросы покупателей</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Закупочные запросы, совпадающие с вашими партиями по культуре, объёму, региону и документам.
            </p>
          </div>
          <Link href='/platform-v7/seller/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            Подбор покупателей
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего запросов', value: String(BUYER_RFQS.length), color: text },
            { label: 'Сильных совпадений', value: String(strongMatches.length), color: green },
            { label: 'Готовых партий', value: String(readyLots.length), color: blue },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {bestRfq && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Лучший покупатель</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 4 }}>{bestRfq.buyerAlias} · {bestRfq.grain} · рейтинг {bestRfq.buyerRating}/100</div>
            </div>
            <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: green, color: '#fff', fontSize: 12, fontWeight: 800 }}>
              Создать оффер
            </Link>
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Активные запросы</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {BUYER_RFQS.map((rfq) => {
            const ms = matchStyle[rfq.matchLevel];
            const isStrong = rfq.matchLevel === 'strong';
            return (
              <div key={rfq.id} style={{ display: 'grid', gap: 10, border: `1px solid ${isStrong ? 'rgba(10,122,95,0.18)' : border}`, borderRadius: 14, padding: 14, background: isStrong ? 'rgba(10,122,95,0.03)' : '#F8FAFB' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 80px auto', gap: 12, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: blue }}>{rfq.id}</span>
                      <span style={{ fontSize: 11, color: muted }}>→ {rfq.matchLotId}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{rfq.grain} · {rfq.volumeTons} т</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{rfq.buyerAlias}</div>
                    <div style={{ fontSize: 12, marginTop: 1 }}>
                      Рейтинг покупателя: <span style={{ color: ratingColor(rfq.buyerRating), fontWeight: 700 }}>{rfq.buyerRating}/100</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{rfq.pricePerTon}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{rfq.basis}</div>
                    <div style={{ fontSize: 11, color: rfq.daysLeft <= 5 ? '#B91C1C' : muted, fontWeight: rfq.daysLeft <= 5 ? 700 : 400, marginTop: 2 }}>
                      {rfq.daysLeft} {rfq.daysLeft === 1 ? 'день' : rfq.daysLeft <= 4 ? 'дня' : 'дней'}
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: ms.bg, border: `1px solid ${ms.borderColor}`, color: ms.color, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>
                      {ms.label}
                    </span>
                  </div>
                  <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: isStrong ? green : '#fff', border: `1px solid ${isStrong ? green : border}`, color: isStrong ? '#fff' : text, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {isStrong ? 'Ответить' : 'Уточнить'}
                  </Link>
                </div>
                {rfq.missingItems && rfq.missingItems.length > 0 && (
                  <div style={{ fontSize: 12, color: amber, padding: '6px 10px', borderRadius: 8, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.14)' }}>
                    Требуется: {rfq.missingItems.join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Создать оффер
        </Link>
        <Link href='/platform-v7/seller/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Подбор покупателей
        </Link>
        <Link href='/platform-v7/seller' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит продавца
        </Link>
      </div>
    </div>
  );
}
