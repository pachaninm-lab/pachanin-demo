import Link from 'next/link';
import { P7ExecutionActionsPanel, type PlatformV7ExecutionActionUiItem } from '@/components/platform-v7/P7ExecutionActionsPanel';
import { PLATFORM_V7_MARKET_RFQ_ROUTE } from '@/lib/platform-v7/routes';
import { PLATFORM_V7_TRADING_SOURCE, rubPerTon, tons } from '@/lib/platform-v7/trading-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const { lot, offers, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
const bestPrice = Math.max(...offers.map((o) => o.priceRubPerTon));

const buyerActionItems = [
  {
    title: 'Принять ставку',
    description: 'Фиксирует выбранную ставку как принятую, блокирует повторное принятие и создаёт журнал действия.',
    targetId: 'e4-accept-offer',
    actionId: 'acceptOffer',
    actorRole: 'buyer',
    entityId: 'OFFER-2403-A',
    mode: 'controlled-pilot',
  },
  {
    title: 'Отклонить ставку',
    description: 'Переводит ставку в отклонённые с возможностью rollback в предыдущее состояние.',
    targetId: 'e4-reject-offer',
    actionId: 'rejectOffer',
    actorRole: 'buyer',
    entityId: 'OFFER-2403-B',
    mode: 'controlled-pilot',
  },
  {
    title: 'Встречное предложение',
    description: 'Создаёт встречное предложение по цене/объёму без раскрытия прямых контактов сторон.',
    targetId: 'e4-counter-offer',
    actionId: 'sendCounterOffer',
    actorRole: 'buyer',
    entityId: 'COUNTER-OFFER-2403-1',
    mode: 'controlled-pilot',
  },
] satisfies readonly PlatformV7ExecutionActionUiItem[];

const checks = [
  ['Источник товара', 'Партия подтянута из ФГИС', 'готово'],
  ['Остаток', `К лоту доступно ${tons(lot.availableVolumeTons)} из ${tons(lot.totalVolumeTons)}`, 'готово'],
  ['Качество', 'Класс, влажность, сорность и клейковина заполнены', 'готово'],
  ['СДИЗ', 'Для сделки потребуется оформление СДИЗ', 'проверить'],
  ['Логистика', `Базис: ${lot.basis}, самовывоз возможен`, 'готово'],
  ['Деньги', 'Ставка уйдёт в сделку только после допуска банка', 'проверить'],
];

function tone(status: string) {
  if (status === 'готово' || status === 'Лучшая ставка') return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'проверить') return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
  return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
}

export default function PlatformV7BuyerLotPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель · лот и ставка</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Как покупатель видит лот и делает ставку</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 930 }}>
              Покупатель видит не только цену. Он видит происхождение партии, доступный остаток, качество, базис поставки, текущие предложения и условия, при которых ставка может стать сделкой.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={PLATFORM_V7_MARKET_RFQ_ROUTE} style={btn()}>Рынок и заявки</Link>
            <Link href='/platform-v7/trading' style={btn('primary')}>Торги и ставки</Link>
          </div>
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T }}>{lot.id} · {lot.crop}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: M }}>{lot.fgisPartyId} · {lot.basis} · урожай {lot.harvestYear}</div>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: BRAND, fontSize: 12, fontWeight: 900 }}>{lot.status}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 }}>
          <Cell label='Доступный объём' value={tons(lot.availableVolumeTons)} />
          <Cell label='Цена продавца' value={rubPerTon(lot.sellerPriceRubPerTon)} />
          <Cell label='Лучшая ставка' value={rubPerTon(bestPrice)} />
          <Cell label='Минимальная партия' value={tons(lot.minVolumeTons)} />
          <Cell label='Срок отгрузки' value={lot.shipmentWindow} />
          <Cell label='Оплата' value={lot.paymentCondition} />
        </div>
      </section>

      <P7ExecutionActionsPanel
        title='Действия покупателя по ставке'
        subtitle='Accept/reject/counter-offer теперь проходят через единый E4-контур: guard, loading, toast, action log и rollback.'
        items={buyerActionItems}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 14 }}>
        <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Проверка перед ставкой</div>
          {checks.map(([label, note, status]) => {
            const t = tone(status);
            return (
              <div key={label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{label}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: M, lineHeight: 1.45 }}>{note}</div>
                </div>
                <span style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{status}</span>
              </div>
            );
          })}
        </section>

        <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Черновик ставки</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <Field label='Цена' value={rubPerTon(acceptedOffer.priceRubPerTon)} />
            <Field label='Объём' value={tons(acceptedOffer.volumeTons)} />
            <Field label='Базис' value={acceptedOffer.basis} />
            <Field label='Срок вывоза' value={`${acceptedOffer.removalTerm} после допуска`} />
            <Field label='Условие денег' value={acceptedOffer.paymentReadiness} />
          </div>
          <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 12, padding: 12, color: T, fontSize: 12, lineHeight: 1.55 }}>
            Ставка фиксируется как намерение. В сделку она переходит только после подтверждения продавца, проверки партии, логистики, документов и банкового допуска.
          </div>
          <Link href='/platform-v7/readiness' style={btn('primary')}>Проверить готовность к сделке</Link>
        </section>
      </div>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Текущие ставки</div>
        {offers.map((offer) => {
          const isAccepted = offer.buyerAlias === acceptedOffer.buyerAlias && offer.priceRubPerTon === acceptedOffer.priceRubPerTon;
          const buyer = isAccepted ? 'Вы' : offer.buyerAlias;
          const t = tone(offer.status);
          return (
            <div key={`${offer.buyerAlias}-${offer.priceRubPerTon}`} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{buyer}</div>
              <div style={{ fontSize: 13, color: T }}>{rubPerTon(offer.priceRubPerTon)}</div>
              <div style={{ fontSize: 13, color: T }}>{tons(offer.volumeTons)}</div>
              <div style={{ fontSize: 13, color: M }}>{offer.basis}</div>
              <span style={{ padding: '4px 8px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{offer.status}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 10, background: SS }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color: T }}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${B}`, paddingBottom: 8 }}>
      <span style={{ fontSize: 12, color: M }}>{label}</span>
      <span style={{ fontSize: 13, color: T, fontWeight: 900 }}>{value}</span>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return {
    textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS,
    border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`, color: kind === 'primary' ? BRAND : T, fontSize: 13, fontWeight: 800,
  };
}
