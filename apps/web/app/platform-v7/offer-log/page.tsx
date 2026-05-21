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

const { lot, offers, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;

const events = [
  ['09:12', 'Лот опубликован', 'Продавец', `${lot.id} создан из партии ${lot.fgisPartyId}`, 'зафиксировано'],
  ['09:18', 'Покупатель сделал ставку', offers[2].buyerAlias, `${rubPerTon(offers[2].priceRubPerTon)} · ${tons(offers[2].volumeTons)} · ${offers[2].basis}`, 'зафиксировано'],
  ['09:24', 'Покупатель сделал ставку', offers[1].buyerAlias, `${rubPerTon(offers[1].priceRubPerTon)} · ${tons(offers[1].volumeTons)} · ${offers[1].basis}`, 'зафиксировано'],
  ['09:37', 'Покупатель изменил ставку', acceptedOffer.buyerAlias, `${rubPerTon(acceptedOffer.priceRubPerTon)} · ${tons(acceptedOffer.volumeTons)} · ${acceptedOffer.basis}`, 'зафиксировано'],
  ['09:40', 'Проверка денег', 'Банк', `${acceptedOffer.buyerAlias} готов к резерву, ${offers[1].buyerAlias} требует проверки`, 'проверить'],
  ['09:48', 'Продавец выбрал ставку', 'Продавец', `Выбрана ставка ${acceptedOffer.buyerAlias}, контакты раскрываются только в черновике сделки`, 'зафиксировано'],
  ['09:50', 'Создан черновик сделки', 'Платформа', 'Условия перенесены из ставки, запуск сделки требует проверок', 'зафиксировано'],
];

const controls = [
  ['Неизменяемость', 'каждое событие получает время, автора, действие и содержание'],
  ['Обезличивание', 'покупатели скрыты до создания черновика сделки'],
  ['Антиобход', 'прямые контакты не показываются в торгах'],
  ['Спорность', 'история ставок доступна оператору и арбитру'],
  ['Банк', 'проверка денег фиксируется до запуска сделки'],
  ['ФГИС', 'лот связан с исходной партией и паспортом товара'],
];

const bidEvents = events.filter(([, action]) => action === 'Покупатель сделал ставку').length;
const changeEvents = events.filter(([, action]) => action === 'Покупатель изменил ставку').length;
const blockerEvents = events.filter(([, , , , status]) => status === 'проверить').length;

function tone(status: string) {
  if (status === 'зафиксировано') return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'проверить') return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
  return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
}

export default function PlatformV7OfferLogPage() {
  return (
    <div data-testid="platform-v7-offer-log-page" style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-offer-log-page']{gap:10px!important;padding:0!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1){padding:16px!important;border-radius:24px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1) > div{display:grid!important;gap:10px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1) > div > div:first-child > div:nth-child(2){font-size:clamp(24px,7vw,34px)!important;line-height:1.06!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1) > div > div:first-child > div:nth-child(3){display:none!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1) a{width:100%!important;min-height:54px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:16px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(1) a:first-child{display:none!important}
          [data-testid='platform-v7-offer-log-page'] > div:nth-of-type(1){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-offer-log-page'] > div:nth-of-type(1) > div{padding:12px!important;border-radius:16px!important}
          [data-testid='platform-v7-offer-log-page'] > div:nth-of-type(1) > div:nth-child(n+4){display:none!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(2){padding:12px!important;border-radius:16px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(2) > div:nth-child(2){font-size:12px!important;line-height:1.45!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3){padding:14px!important;border-radius:20px!important;gap:9px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3) > div:not(:first-child){grid-template-columns:58px 1fr!important;gap:8px!important;padding:12px!important;border-radius:16px!important;align-items:start!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3) > div:not(:first-child) > div:nth-child(3),
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3) > div:not(:first-child) > div:nth-child(4){display:none!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3) > div:not(:first-child) > span{grid-column:1 / -1!important;width:fit-content!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(3) > div:nth-of-type(n+6){display:none!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(4){padding:14px!important;border-radius:20px!important;gap:9px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(4) > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(4) > div:nth-child(2) > div{padding:12px!important;border-radius:16px!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(4) > div:nth-child(2) > div:nth-child(n+5){display:none!important}
          [data-testid='platform-v7-offer-log-page'] > section:nth-of-type(4) > div:nth-child(2) > div > div:nth-child(2){display:none!important}
        }
      `}</style>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Журнал торгов · доказательства</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>История ставок и действий по лоту</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 940 }}>
              Журнал фиксирует путь от публикации лота до черновика сделки. Он нужен, чтобы доказать, кто сделал ставку, что изменилось, почему ставка была выбрана и где возник блокер.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/trading' style={btn()}>Торги</Link>
            <Link href='/platform-v7/offer-to-deal' style={btn('primary')}>Черновик сделки</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Metric label='Событий' value={String(events.length)} tone='good' />
        <Metric label='Ставок' value={String(bidEvents)} tone='good' />
        <Metric label='Изменений' value={String(changeEvents)} tone='warn' />
        <Metric label='Блокеров' value={String(blockerEvents)} tone='warn' />
      </div>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Ставка не редактируется задним числом. Любое изменение создаёт новое событие. Продавец видит обезличенного покупателя, оператор и банк видят полный контур проверки.
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Лента событий</div>
        {events.map(([time, action, actor, note, status]) => {
          const t = tone(status);
          return (
            <div key={`${time}-${action}`} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gridTemplateColumns: '70px minmax(160px, 0.8fr) minmax(140px, 0.7fr) minmax(240px, 1.4fr) auto', gap: 10, alignItems: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND }}>{time}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{action}</div>
              <div style={{ fontSize: 12, color: M }}>{actor}</div>
              <div style={{ fontSize: 12, color: T, lineHeight: 1.45 }}>{note}</div>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{status}</span>
            </div>
          );
        })}
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Контрольные правила</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {controls.map(([label, note]) => (
            <div key={label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{label}</div>
              <div style={{ marginTop: 5, fontSize: 12, color: M, lineHeight: 1.5 }}>{note}</div>
            </div>
          ))}
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
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: palette.color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS, border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`, color: kind === 'primary' ? BRAND : T, fontSize: 13, fontWeight: 800 };
}
