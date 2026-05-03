import Link from 'next/link';
import { selectAllDeals } from '@/lib/domain/selectors';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { SANDBOX_FGIS_PARTIES, canCreateLotPassport } from '@/lib/platform-v7/fgis-lot-passport';
import { PLATFORM_V7_TRADING_SOURCE, rubPerTon, tons } from '@/lib/platform-v7/trading-source-of-truth';
import { PLATFORM_V7_EXECUTION_SOURCE, formatRub, formatTons } from '@/lib/platform-v7/deal-execution-source-of-truth';

const SURFACE = 'var(--pc-bg-card)';
const SURFACE_SOFT = 'var(--pc-bg-elevated)';
const BORDER = 'var(--pc-border)';
const TEXT = 'var(--pc-text-primary)';
const MUTED = 'var(--pc-text-secondary)';
const ACCENT = 'var(--pc-accent-strong)';
const ACCENT_BG = 'var(--pc-accent-bg)';
const ACCENT_BORDER = 'var(--pc-accent-border)';
const DANGER_BG = 'rgba(255,139,144,0.08)';
const DANGER_BORDER = 'rgba(255,139,144,0.18)';
const DANGER_TEXT = '#FF8B90';
const WARNING_TEXT = '#B45309';

const LIVE_SELLER_LOT = {
  id: 'LOT-2405',
  crop: 'Пшеница 4 класса',
  volumeTons: 240,
  basis: 'Тамбовская область · EXW',
  endsAt: 'осталось 01:18:42',
  status: 'Идут ставки',
  offers: [
    { buyerAlias: 'Покупатель 4', buyerRating: 'A', priceRubPerTon: 16120, volumeTons: 240, paymentReadiness: 'резерв готов', status: 'Лучшая ставка' },
    { buyerAlias: 'Покупатель 2', buyerRating: 'B+', priceRubPerTon: 16040, volumeTons: 240, paymentReadiness: 'нужна проверка', status: 'Активна' },
    { buyerAlias: 'Покупатель 5', buyerRating: 'A-', priceRubPerTon: 15990, volumeTons: 180, paymentReadiness: 'резерв готов', status: 'Активна' },
  ],
} as const;

export default function PlatformV7SellerPage() {
  const sellerDeals = selectAllDeals().filter((deal) => deal.seller.name === 'Агро-Юг ООО' || deal.seller.name === 'КФХ Мирный' || deal.seller.name === 'КФХ Петров' || deal.seller.name === 'АО СолнцеАгро');
  const totalExpected = sellerDeals.reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const totalHold = sellerDeals.reduce((sum, deal) => sum + deal.holdAmount, 0);
  const nextPayout = sellerDeals.filter((deal) => deal.status === 'release_requested' || deal.status === 'docs_complete').reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const blockedDeals = sellerDeals.filter((deal) => deal.holdAmount > 0 || deal.blockers.length > 0);
  const actionDeal = blockedDeals[0] ?? sellerDeals[0];

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <SellerLotsAndBidsTop />

      <FgisQuickStatus />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title='Получите' value={formatCompactMoney(totalExpected)} note='Общая сумма, которая должна прийти продавцу.' />
        <Metric title='Ближайшая выплата' value={formatCompactMoney(nextPayout)} note='Деньги, которые ближе всего к выпуску.' tone='green' />
        <Metric title='Удержано' value={formatCompactMoney(totalHold)} note='Сумма под спором, документами или проверкой.' tone='red' />
        <Metric title='Проблемные сделки' value={String(blockedDeals.length)} note='Требуют действия прямо сейчас.' tone='red' />
      </div>

      {actionDeal ? (
        <section style={{ background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 12, color: DANGER_TEXT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Главное действие</div>
          <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: TEXT, marginTop: 8 }}>{actionDeal.id} · {actionDeal.grain}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: MUTED }}>Статус: {statusLabel(actionDeal.status)} · Удержано: {formatCompactMoney(actionDeal.holdAmount)}</div>
          <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>{actionDeal.holdAmount > 0 ? 'Закройте спор или недостающие документы, чтобы снять удержание.' : actionDeal.blockers.length ? 'Уберите причины остановки, чтобы довести сделку до выпуска.' : 'Создайте новый лот или доведите текущую сделку до следующего этапа.'}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${actionDeal.id}`} style={btn('primary')}>Открыть сделку</Link>
            <Link href='/platform-v7/lots/create' style={btn()}>Создать лот</Link>
          </div>
        </section>
      ) : null}

      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Ваши сделки</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {sellerDeals.map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', color: 'inherit', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, background: SURFACE_SOFT, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: ACCENT }}>{deal.id}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{statusLabel(deal.status)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <Cell label='К выплате' value={formatCompactMoney(deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0))} />
                <Cell label='Удержано' value={formatCompactMoney(deal.holdAmount)} danger={deal.holdAmount > 0} />
                <Cell label='Покупатель' value={deal.buyer.name} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SellerLotsAndBidsTop() {
  const { lot, offers, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
  const { deal, logistics, money, documents } = PLATFORM_V7_EXECUTION_SOURCE;
  const chain = [
    { label: 'Лот', value: lot.id, href: `/platform-v7/lots/${lot.id}` },
    { label: 'Победитель', value: acceptedOffer.buyerAlias, href: '/platform-v7/seller/offers' },
    { label: 'Сделка', value: deal.id, href: `/platform-v7/deals/${deal.id}/clean` },
    { label: 'Деньги', value: formatRub(money.reservedRub), href: '/platform-v7/bank' },
    { label: 'Логистика', value: logistics.orderId, href: '/platform-v7/logistics/inbox' },
    { label: 'Рейс', value: logistics.tripId, href: '/platform-v7/driver' },
  ] as const;

  return (
    <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: `1px solid ${BORDER}`, borderRadius: 26, padding: 20, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 8, maxWidth: 860 }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: ACCENT, fontSize: 12, fontWeight: 900 }}>
            Лоты продавца · ставки покупателей
          </div>
          <h1 style={{ margin: 0, color: TEXT, fontSize: 'clamp(32px, 7.8vw, 54px)', lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 950 }}>
            Лот должен приводить к сделке, документам и получению денег
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.58 }}>
            Сверху продавец видит ставки покупателей, рейтинг, время окончания и победителя. После принятия ставки сразу видна дальнейшая цепочка сделки.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/lots/create' style={btn('primary')}>Создать лот</Link>
          <Link href='/platform-v7/seller/offers' style={btn()}>Все предложения</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(260px, 0.85fr)', gap: 14 }}>
        <article style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={microLabel}>Принятая ставка</div>
              <h2 style={{ margin: '5px 0 0', color: TEXT, fontSize: 30, lineHeight: 1.08, fontWeight: 950 }}>{lot.id} · {lot.crop}</h2>
              <p style={{ margin: '7px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.5 }}>{tons(acceptedOffer.volumeTons)} · {lot.basis} · окончание: победитель выбран</p>
            </div>
            <span style={{ ...statusPill, background: ACCENT_BG, borderColor: ACCENT_BORDER, color: ACCENT }}>Победитель</span>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {offers.map((offer) => (
              <OfferRow
                key={offer.buyerAlias}
                buyer={offer.buyerAlias}
                rating={offer.buyerRating}
                price={rubPerTon(offer.priceRubPerTon)}
                volume={tons(offer.volumeTons)}
                readiness={offer.paymentReadiness}
                status={offer.buyerAlias === acceptedOffer.buyerAlias ? 'Принята' : offer.status}
                accepted={offer.buyerAlias === acceptedOffer.buyerAlias}
              />
            ))}
          </div>
        </article>

        <article style={{ background: '#0F172A', color: '#fff', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ ...microLabel, color: '#A7F3D0' }}>Дальнейшая цепочка</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.08 }}>Ставка уже ведёт в сделку</h2>
            <p style={{ margin: '8px 0 0', color: '#CBD5E1', fontSize: 13, lineHeight: 1.55 }}>
              {deal.crop} · {formatTons(deal.volumeTons)} · резерв {formatRub(money.reservedRub)} · документы: {documents.transportPackStatus}
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {chain.map((item, index) => (
              <Link key={item.label} href={item.href} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'center', color: '#fff' }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: 'inline-grid', placeItems: 'center', background: index < 3 ? '#0A7A5F' : 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 950 }}>{index + 1}</span>
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ color: '#94A3B8', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
                  <strong style={{ color: '#fff', fontSize: 14 }}>{item.value}</strong>
                </span>
              </Link>
            ))}
          </div>
        </article>
      </div>

      <article style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={microLabel}>Лот в торгах</div>
            <h2 style={{ margin: '5px 0 0', color: TEXT, fontSize: 26, lineHeight: 1.1, fontWeight: 950 }}>{LIVE_SELLER_LOT.id} · {LIVE_SELLER_LOT.crop}</h2>
            <p style={{ margin: '7px 0 0', color: MUTED, fontSize: 13 }}>{formatTons(LIVE_SELLER_LOT.volumeTons)} · {LIVE_SELLER_LOT.basis}</p>
          </div>
          <span style={{ ...statusPill, background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.22)', color: WARNING_TEXT }}>Окончание: {LIVE_SELLER_LOT.endsAt}</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {LIVE_SELLER_LOT.offers.map((offer) => (
            <OfferRow
              key={offer.buyerAlias}
              buyer={offer.buyerAlias}
              rating={offer.buyerRating}
              price={rubPerTon(offer.priceRubPerTon)}
              volume={tons(offer.volumeTons)}
              readiness={offer.paymentReadiness}
              status={offer.status}
              accepted={offer.status === 'Лучшая ставка'}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

function OfferRow({ buyer, rating, price, volume, readiness, status, accepted }: { buyer: string; rating: string; price: string; volume: string; readiness: string; status: string; accepted?: boolean }) {
  return (
    <div style={{ border: `1px solid ${accepted ? ACCENT_BORDER : BORDER}`, background: accepted ? ACCENT_BG : SURFACE_SOFT, borderRadius: 16, padding: 12, display: 'grid', gridTemplateColumns: 'minmax(140px,1.1fr) repeat(4,minmax(88px,0.8fr))', gap: 10, alignItems: 'center' }}>
      <div>
        <div style={{ color: TEXT, fontSize: 15, fontWeight: 900 }}>{buyer}</div>
        <div style={{ marginTop: 3, color: MUTED, fontSize: 12 }}>рейтинг {rating}</div>
      </div>
      <SmallValue label='Цена' value={price} strong={accepted} />
      <SmallValue label='Объём' value={volume} />
      <SmallValue label='Деньги' value={readiness} />
      <span style={{ ...statusPill, justifySelf: 'start', background: accepted ? ACCENT_BG : '#fff', borderColor: accepted ? ACCENT_BORDER : BORDER, color: accepted ? ACCENT : MUTED }}>{status}</span>
    </div>
  );
}

function SmallValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={microLabel}>{label}</div>
      <div style={{ marginTop: 3, color: strong ? ACCENT : TEXT, fontSize: 13, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function FgisQuickStatus() {
  const parties = SANDBOX_FGIS_PARTIES;
  const verified = parties.filter((party) => party.status === 'verified').length;
  const errors = parties.filter((party) => party.status === 'sync_error').length;
  const canCreate = parties.filter((party) => canCreateLotPassport(party)).length;
  const totalTons = parties.reduce((sum, party) => sum + party.batches.reduce((batchSum, batch) => batchSum + batch.volumeTons, 0), 0);

  return (
    <section style={{ background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ФГИС ЗЕРНО · <span style={{ color: WARNING_TEXT }}>тестовый режим</span>
          </span>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            {verified} орг. подтверждено · {canCreate} готовы к созданию лота · {totalTons} т в тестовом сценарии
            {errors > 0 && <span style={{ marginLeft: 8, color: DANGER_TEXT, fontWeight: 700 }}>· {errors} ошибка синхронизации</span>}
          </div>
        </div>
        <Link href='/platform-v7/seller/fgis-parties' style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: ACCENT, padding: '8px 12px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10 }}>
          Открыть партии →
        </Link>
      </div>
    </section>
  );
}

function Metric({ title, value, note, tone = 'default' }: { title: string; value: string; note: string; tone?: 'default' | 'green' | 'red' }) {
  const palette = tone === 'green'
    ? { bg: ACCENT_BG, border: ACCENT_BORDER, value: ACCENT }
    : tone === 'red'
      ? { bg: DANGER_BG, border: DANGER_BORDER, value: DANGER_TEXT }
      : { bg: SURFACE, border: BORDER, value: TEXT };
  return (
    <section style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: palette.value }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>{note}</div>
    </section>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, background: SURFACE }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: danger ? DANGER_TEXT : TEXT, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SURFACE_SOFT, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700 };
}

const microLabel = { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 } as const;
const statusPill = { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '7px 10px', borderRadius: 999, border: `1px solid ${BORDER}`, fontSize: 12, fontWeight: 900 } as const;
