import Link from 'next/link';
import { P7ExecutionActionsPanel, type PlatformV7ExecutionActionUiItem } from '@/components/platform-v7/P7ExecutionActionsPanel';
import { PLATFORM_V7_TRADING_SOURCE, rubPerTon, tons } from '@/lib/platform-v7/trading-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const { lot, offers: sourceOffers } = PLATFORM_V7_TRADING_SOURCE;

const sellerActionItems = [
  {
    title: 'Отправить ставку продавца',
    description: 'Фиксирует намерение продавца по лоту, пишет action log и даёт rollback без раскрытия контактов покупателя.',
    targetId: 'e4-submit-seller-offer',
    actionId: 'submitSellerOffer',
    actorRole: 'seller',
    entityId: 'OFFER-SELLER-2403',
    mode: 'controlled-pilot',
  },
] satisfies readonly PlatformV7ExecutionActionUiItem[];

const lotOffers = sourceOffers.map((o) => ({
  lot: lot.id,
  buyer: o.buyerAlias,
  rating: o.buyerRating,
  price: rubPerTon(o.priceRubPerTon),
  volume: tons(o.volumeTons),
  basis: o.basis,
  pay: o.paymentReadiness,
  term: o.removalTerm,
  status: o.status,
  risk: o.risk,
}));

const demoOffers = [
  { lot: 'Лот ВРЖ-1811', buyer: 'Покупатель 4', rating: 'C+', price: '13 300 ₽/т', volume: '800 т', basis: 'Самовывоз', pay: 'нет допуска', term: '5 дней', status: 'Остановить', risk: 'высокий' },
];

const offers = [...lotOffers, ...demoOffers];

function tone(value: string) {
  if (['Лучшая ставка', 'готов к резерву', 'низкий'].includes(value)) return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (['Остановить', 'нет допуска', 'высокий'].includes(value)) return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
  return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
}

export default function PlatformV7SellerOffersPage() {
  const best = offers.filter((offer) => offer.status === 'Лучшая ставка').length;
  const stopped = offers.filter((offer) => offer.status === 'Остановить' || offer.pay === 'нет допуска').length;
  const readyMoney = offers.filter((offer) => offer.pay === 'готов к резерву').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец · ставки по лотам</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Кто и на каких условиях готов купить товар</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 940 }}>
              До принятия ставки покупатели обезличены. Продавец видит цену, объём, базис, срок, готовность денег и риск, но не получает прямые контакты покупателя.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/trading' style={btn()}>Торги и ставки</Link>
            <Link href='/platform-v7/readiness' style={btn('primary')}>Готовность сделки</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Metric label='Всего ставок' value={String(offers.length)} tone='good' />
        <Metric label='Лучшие ставки' value={String(best)} tone='good' />
        <Metric label='Готовы деньги' value={String(readyMoney)} tone='good' />
        <Metric label='Остановить' value={String(stopped)} tone={stopped > 0 ? 'bad' : 'good'} />
      </div>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило раскрытия</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Личность покупателя раскрывается продавцу только после выбора ставки и создания черновика сделки внутри платформы. Оператор, банк и проверочный контур видят полные данные сразу.
        </div>
      </section>

      <P7ExecutionActionsPanel
        title='Действие продавца по ставке'
        subtitle='Первый seller action wiring: состояние, блокировка повторной отправки, toast, action log и rollback без live-интеграций.'
        items={sellerActionItems}
      />

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Ставки по лотам продавца</div>
        {offers.map((offer) => {
          const statusTone = tone(offer.status);
          const payTone = tone(offer.pay);
          const riskTone = tone(offer.risk);
          return (
            <div key={`${offer.lot}-${offer.buyer}-${offer.price}`} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: T }}>{offer.lot}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: M }}>{offer.buyer} · рейтинг {offer.rating} · контакты скрыты</div>
                </div>
                <span style={{ padding: '5px 10px', borderRadius: 999, background: statusTone.bg, border: `1px solid ${statusTone.border}`, color: statusTone.color, fontSize: 12, fontWeight: 900 }}>{offer.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
                <Cell label='Цена' value={offer.price} />
                <Cell label='Объём' value={offer.volume} />
                <Cell label='Базис' value={offer.basis} />
                <Cell label='Срок вывоза' value={offer.term} />
                <PillCell label='Деньги' value={offer.pay} tone={payTone} />
                <PillCell label='Риск' value={offer.risk} tone={riskTone} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: M, fontSize: 12, lineHeight: 1.45 }}>Операционные кнопки перенесены в E4-панель выше: там есть состояние, журнал и откат.</span>
                <Link href='/platform-v7/readiness' style={btn()}>Проверить готовность</Link>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div style={{ background: tone === 'good' ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${tone === 'good' ? 'rgba(10,122,95,0.18)' : 'rgba(220,38,38,0.18)'}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: tone === 'good' ? BRAND : ERR, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 10, background: S }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color: T }}>{value}</div>
    </div>
  );
}

function PillCell({ label, value, tone }: { label: string; value: string; tone: { color: string; bg: string; border: string } }) {
  return (
    <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 10, background: S }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <span style={{ display: 'inline-flex', marginTop: 5, padding: '4px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 900 }}>{value}</span>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS, border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`, color: kind === 'primary' ? BRAND : T, fontSize: 13, fontWeight: 800 };
}
