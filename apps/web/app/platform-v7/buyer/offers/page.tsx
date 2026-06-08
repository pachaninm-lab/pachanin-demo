import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

type OfferStatus = 'pending' | 'accepted' | 'countered' | 'expired';

const statusStyle: Record<OfferStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  pending: { label: 'ОЖИДАНИЕ ОТВЕТА', color: amber, bg: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.18)' },
  accepted: { label: 'ПРИНЯТО', color: green, bg: 'rgba(10,122,95,0.08)', borderColor: 'rgba(10,122,95,0.18)' },
  countered: { label: 'ВСТРЕЧНОЕ ПРЕДЛОЖЕНИЕ', color: blue, bg: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.18)' },
  expired: { label: 'ИСТЁК СРОК', color: '#6B778C', bg: 'rgba(107,114,128,0.08)', borderColor: 'rgba(107,114,128,0.18)' },
};

const scenarios = Object.values(DEAL360_SCENARIOS);
const readyLots = lots.filter((l) => l.readiness.state === 'PASS').slice(0, 3);

const OFFERS = [
  {
    id: 'OFFER-2401',
    lotId: readyLots[0]?.id ?? 'LOT-2403',
    grain: readyLots[0]?.grain ?? 'Ячмень',
    volume: readyLots[0]?.volumeTons ?? 180,
    offerPrice: '14 800 ₽/т',
    dealId: scenarios[0]?.dealId,
    status: 'accepted' as OfferStatus,
    expiresIn: null,
    note: 'Условия приняты продавцом. Идёт оформление сделки.',
  },
  {
    id: 'OFFER-2402',
    lotId: readyLots[1]?.id ?? 'LOT-2404',
    grain: readyLots[1]?.grain ?? 'Подсолнечник',
    volume: readyLots[1]?.volumeTons ?? 420,
    offerPrice: '32 400 ₽/т',
    dealId: null,
    status: 'countered' as OfferStatus,
    expiresIn: '2 дня',
    note: 'Продавец предлагает 33 000 ₽/т. Нужен ответ.',
  },
  {
    id: 'OFFER-2403',
    lotId: readyLots[2]?.id ?? 'LOT-2405',
    grain: readyLots[2]?.grain ?? 'Пшеница 3 кл.',
    volume: readyLots[2]?.volumeTons ?? 560,
    offerPrice: '13 200 ₽/т',
    dealId: null,
    status: 'pending' as OfferStatus,
    expiresIn: '5 дней',
    note: 'Предложение отправлено. Ожидаем ответа продавца.',
  },
];

export default function BuyerOffersPage() {
  const pendingOffers = OFFERS.filter((o) => o.status === 'pending' || o.status === 'countered');

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Мои предложения</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Статусы предложений, встречные условия, сроки и переход к сделке.
            </p>
          </div>
          <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Найти лот
          </Link>
        </div>
        {pendingOffers.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.16)', fontSize: 13, color: amber, fontWeight: 700 }}>
            {pendingOffers.length} {pendingOffers.length === 1 ? 'предложение требует' : 'предложения требуют'} внимания
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Предложения</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {OFFERS.map((offer) => {
            const st = statusStyle[offer.status];
            const isCountered = offer.status === 'countered';
            return (
              <div key={offer.id} style={{ border: `1px solid ${isCountered ? 'rgba(37,99,235,0.18)' : border}`, borderRadius: 14, padding: 14, background: isCountered ? 'rgba(37,99,235,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: blue }}>{offer.id}</span>
                      <span style={{ fontSize: 12, color: muted }}>→</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: muted }}>{offer.lotId}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: text, marginTop: 4 }}>{offer.grain}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{offer.volume} т · {offer.offerPrice}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: st.bg, border: `1px solid ${st.borderColor}`, color: st.color, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>{offer.note}</div>
                {offer.expiresIn && (
                  <div style={{ fontSize: 12, color: red, fontWeight: 700 }}>Срок действия: {offer.expiresIn}</div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {offer.status === 'accepted' && offer.dealId && (
                    <Link href={`/platform-v7/deals/${offer.dealId}/clean`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: green, color: '#fff', fontSize: 12, fontWeight: 800 }}>
                      Открыть сделку →
                    </Link>
                  )}
                  {offer.status === 'countered' && (
                    <Link href='/platform-v7/offer-log' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: blue, color: '#fff', fontSize: 12, fontWeight: 800 }}>
                      Ответить на встречное
                    </Link>
                  )}
                  {offer.status === 'pending' && (
                    <Link href='/platform-v7/offer-log' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700 }}>
                      Журнал предложения
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, border: `1px solid ${blue}`, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Найти новый лот
        </Link>
        <Link href='/platform-v7/offer-log' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Журнал предложений
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
