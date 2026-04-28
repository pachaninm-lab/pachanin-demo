import Link from 'next/link';
import { PLATFORM_V7_TRADING_SOURCE } from '@/lib/platform-v7/trading-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const rules = [
  ['Скрытие контактов', 'До черновика сделки продавец видит обезличенного покупателя, рейтинг и готовность денег, но не телефон, почту и название компании.', 'готово'],
  ['Раскрытие сторон', 'Покупатель и продавец раскрываются друг другу только внутри черновика сделки, созданного из выбранной ставки.', 'готово'],
  ['Журнал действий', 'Ставка, изменение ставки, выбор предложения и создание черновика фиксируются в журнале торгов.', 'готово'],
  ['Банк и оператор', 'Банк, оператор и проверочный контур видят полные данные сторон для комплаенса и выпуска денег.', 'готово'],
  ['Запрет ручного контакта', 'Сообщения с телефонами, почтой и внешними ссылками должны попадать в проверку.', 'проверить'],
  ['Повторная сделка вне платформы', 'Повторные сделки между сторонами должны проверяться по истории контактов и прошлых черновиков.', 'проверить'],
];

const visibility = [
  ['Другие покупатели', 'цена, объём, базис, статус ставки', 'без личности'],
  ['Продавец до выбора', 'обезличенный покупатель, рейтинг, деньги, риск', 'без контактов'],
  ['Продавец после выбора', 'стороны раскрыты внутри черновика сделки', 'только в платформе'],
  ['Оператор', 'полные данные, журнал, блокеры, риск обхода', 'полный доступ'],
  ['Банк', 'полные данные, деньги, комплаенс, решение по резерву', 'полный доступ'],
];

function tone(status: string) {
  if (status === 'готово') return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'проверить') return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
  return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
}

export default function PlatformV7AntiBypassPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Антиобход · правила раскрытия</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Как платформа удерживает сделку внутри контура</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 940 }}>
              Антиобход нужен, чтобы стороны не использовали платформу как витрину контактов. Контакты раскрываются только после выбора ставки и создания черновика сделки внутри платформы.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/offer-log' style={btn()}>Журнал торгов</Link>
            <Link href='/platform-v7/offer-to-deal' style={btn('primary')}>Черновик сделки</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Metric label='Правил' value={String(rules.length)} tone='good' />
        <Metric label='Готово' value={String(rules.filter((rule) => rule[2] === 'готово').length)} tone='good' />
        <Metric label='Проверить' value={String(rules.filter((rule) => rule[2] === 'проверить').length)} tone='warn' />
      </div>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ключевое правило</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Цена и условия видны рынку, но контакт и полная личность стороны раскрываются только в защищённом черновике сделки. Любая попытка увести контакт должна фиксироваться как риск обхода.
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Правила антиобхода</div>
        {rules.map(([title, note, status]) => {
          const t = tone(status);
          return (
            <div key={title} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, color: T, fontWeight: 900 }}>{title}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: M, lineHeight: 1.5 }}>{note}</div>
              </div>
              <span style={{ whiteSpace: 'nowrap', padding: '5px 9px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{status}</span>
            </div>
          );
        })}
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Кто что видит</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {visibility.map(([role, sees, level]) => (
            <div key={role} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,0.7fr) minmax(220px,1.4fr) minmax(120px,0.6fr)', gap: 10, background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: T, fontWeight: 900 }}>{role}</div>
              <div style={{ fontSize: 12, color: M, lineHeight: 1.45 }}>{sees}</div>
              <div style={{ fontSize: 12, color: BRAND, fontWeight: 900 }}>{level}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 12, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Текущий пример</div>
        <div style={{ marginTop: 8, fontSize: 13, color: T, lineHeight: 1.65 }}>
          Лот: <strong>{PLATFORM_V7_TRADING_SOURCE.lot.id}</strong> · ставок: <strong>{PLATFORM_V7_TRADING_SOURCE.offers.length}</strong> · выбранная ставка: <strong>{PLATFORM_V7_TRADING_SOURCE.acceptedOffer.buyerAlias}</strong>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: M }}>
          Покупатель до сделки обезличен. Реальные контактные данные платформа не показывает.
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' }) {
  const palette = tone === 'good'
    ? { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: BRAND }
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
