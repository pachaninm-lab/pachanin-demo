import Link from 'next/link';

const sourcePrice = 14290;
const logisticsCost = 6873;
const deliveredPrice = sourcePrice + logisticsCost;

const card = {
  display: 'grid',
  gap: 10,
  border: '1px solid var(--pc-border, #E4E6EA)',
  borderRadius: 18,
  background: 'var(--pc-bg-card, #fff)',
  padding: 16,
} as const;

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 14,
} as const;

const muted = { margin: 0, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.55, fontSize: 13 } as const;
const text = { margin: 0, color: 'var(--pc-text-primary, #0F172A)', lineHeight: 1.6 } as const;
const link = { color: '#0A7A5F', fontWeight: 800, textDecoration: 'none' } as const;

export default function PlatformV7MarketEntryPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card}>
        <div style={{ color: 'var(--pc-text-secondary, #475569)', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Предсделочный контур
        </div>
        <h1 style={{ margin: 0, fontSize: 'clamp(30px, 6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.04em' }}>
          Рынок и заявки
        </h1>
        <p style={text}>
          Цена, маршрут и интерес сторон фиксируются до запуска сделки. Сделка, документы и деньги не создаются автоматически.
        </p>
      </section>

      <section style={grid}>
        <article style={card}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Расчёт основания</h2>
          <p style={text}>
            Пшеница 4 класса · {sourcePrice.toLocaleString('ru-RU')} ₽/т источник · {logisticsCost.toLocaleString('ru-RU')} ₽/т логистика · {deliveredPrice.toLocaleString('ru-RU')} ₽/т до точки.
          </p>
          <p style={muted}>Источник требует регулярной сверки. Это не автоматическая котировка и не биржевой приказ.</p>
        </article>

        <article style={card}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Gate перед сделкой</h2>
          <p style={text}>
            Перед переходом в исполнение нужны проверка контрагента, документы, логистика и финансовое основание.
          </p>
          <p style={muted}>Этот слой не двигает деньги и не создаёт сделку без допуска.</p>
        </article>

        <article style={card}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Следующие действия</h2>
          <Link href='/platform-v7/lots/create' style={link}>Создать лот</Link>
          <Link href='/platform-v7/market-rfq' style={link}>Оферты и RFQ</Link>
          <Link href='/platform-v7/bank' style={link}>Финансовое основание</Link>
        </article>
      </section>
    </main>
  );
}
