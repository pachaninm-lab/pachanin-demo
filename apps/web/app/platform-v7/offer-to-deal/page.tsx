import Link from 'next/link';
import { PLATFORM_V7_TRADING_SOURCE, rubPerTon, tons } from '@/lib/platform-v7/trading-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const { lot, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;

const transfer = [
  ['Лот', lot.id, 'из торгов'],
  ['Партия ФГИС', lot.fgisPartyId, 'не менять'],
  ['Покупатель', 'раскрыт после выбора ставки', 'только внутри сделки'],
  ['Продавец', lot.seller, 'из паспорта партии'],
  ['Цена', rubPerTon(acceptedOffer.priceRubPerTon), 'из принятой ставки'],
  ['Объём', tons(acceptedOffer.volumeTons), 'из принятой ставки'],
  ['Базис', acceptedOffer.basis, 'из принятой ставки'],
  ['Оплата', lot.paymentCondition, 'требует банка'],
];

const gates = [
  ['ФГИС', 'партия подтверждена, остаток достаточен', 'готово'],
  ['Качество', 'показатели заполнены, но лаборатория нужна на приёмке', 'проверить'],
  ['Логистика', 'нужен слот вывоза и водитель', 'проверить'],
  ['Документы', 'нужен договор, СДИЗ и транспортный пакет', 'проверить'],
  ['Банк', 'нужно зарезервировать деньги покупателя', 'проверить'],
  ['Обход платформы', 'контакты сторон не раскрыты вне черновика', 'готово'],
];

const blockers = gates.filter(([, , s]) => s !== 'готово').length;

function tone(status: string) {
  if (status === 'готово') return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'стоп') return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
  return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
}

export default function PlatformV7OfferToDealPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ставка → черновик сделки</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Как принятая ставка становится сделкой</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 940 }}>
              После выбора ставки платформа раскрывает стороны только внутри черновика сделки, переносит условия торгов и запускает проверки: ФГИС, документы, логистика, банк и риск обхода.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/seller/offers' style={btn()}>Ставки продавца</Link>
            <Link href='/platform-v7/readiness' style={btn('primary')}>Готовность сделки</Link>
          </div>
        </div>
      </section>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Черновик сделки не выпускает деньги и не создаёт обязательство автоматически. Он фиксирует источник условий и показывает, какие проверки должны пройти до договора и резерва денег.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <Metric label='Статус' value='черновик' tone='warn' />
        <Metric label='Цена' value={rubPerTon(acceptedOffer.priceRubPerTon)} tone='good' />
        <Metric label='Объём' value={tons(acceptedOffer.volumeTons)} tone='good' />
        <Metric label='Блокеры' value={String(blockers)} tone='bad' />
      </div>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Что переносится из ставки</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {transfer.map(([label, value, source]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,0.6fr) minmax(180px,1fr) minmax(120px,0.6fr)', gap: 10, background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: 13, color: T, fontWeight: 900 }}>{value}</div>
              <div style={{ fontSize: 12, color: BRAND, fontWeight: 800 }}>{source}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Проверки до запуска сделки</div>
        {gates.map(([label, note, status]) => {
          const t = tone(status);
          return (
            <div key={label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, color: T, fontWeight: 900 }}>{label}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: M, lineHeight: 1.45 }}>{note}</div>
              </div>
              <span style={{ whiteSpace: 'nowrap', padding: '5px 9px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{status}</span>
            </div>
          );
        })}
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Следующие действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href='/platform-v7/readiness' style={btn('primary')}>Проверить готовность</Link>
          <Link href='/platform-v7/logistics' style={btn()}>Назначить логистику</Link>
          <Link href='/platform-v7/bank/release-safety' style={btn()}>Проверить деньги</Link>
          <Link href='/platform-v7/deals' style={btn()}>Реестр сделок</Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'warn' }) {
  const palette = tone === 'good'
    ? { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: BRAND }
    : tone === 'bad'
      ? { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: ERR }
      : { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: WARN };
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: palette.color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS, border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`, color: kind === 'primary' ? BRAND : T, fontSize: 13, fontWeight: 800 };
}
