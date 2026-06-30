import Link from 'next/link';

const price = 14290;
const logistics = 6873;
const delivered = price + logistics;

export default function MarketEntryPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card}>
        <div style={eyebrow}>Предсделочный контур</div>
        <h1 style={title}>Рынок и заявки</h1>
        <p style={text}>Цена, маршрут и интерес сторон фиксируются до запуска сделки. Сделка, деньги и документы не создаются автоматически.</p>
      </section>
      <section style={grid}>
        <article style={card}>
          <h2 style={heading}>Расчёт основания</h2>
          <p style={text}>Пшеница 4 класса · {price.toLocaleString('ru-RU')} ₽/т источник · {logistics.toLocaleString('ru-RU')} ₽/т логистика · {delivered.toLocaleString('ru-RU')} ₽/т до точки.</p>
          <p style={muted}>Источник требует регулярной сверки. Это не автоматическая котировка и не биржевой приказ.</p>
        </article>
        <article style={card}>
          <h2 style={heading}>Gate перед сделкой</h2>
          <p style={text}>Перед переходом в исполнение нужны проверка контрагента, документы, логистика и финансовое основание.</p>
          <p style={muted}>Этот слой не двигает деньги и не создаёт сделку без допуска.</p>
        </article>
        <article style={card}>
          <h2 style={heading}>Следующие действия</h2>
          <Link href='/platform-v7/lots/create' style={link}>Создать лот</Link>
          <Link href='/platform-v7/market-rfq' style={link}>Оферты и RFQ</Link>
          <Link href='/platform-v7/bank' style={link}>Финансовое основание</Link>
        </article>
      </section>
    </main>
  );
}

const card = { display: 'grid', gap: 10, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 } as const;
const eyebrow = { color: 'var(--pc-text-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' } as const;
const title = { margin: 0, fontSize: 'clamp(30px,6vw,46px)', lineHeight: 1.05, letterSpacing: '-0.04em' } as const;
const heading = { margin: 0, fontSize: 18 } as const;
const text = { margin: 0, color: 'var(--pc-text-primary)', lineHeight: 1.6 } as const;
const muted = { margin: 0, color: 'var(--pc-text-secondary)', lineHeight: 1.55, fontSize: 13 } as const;
const link = { color: '#0A7A5F', fontWeight: 800, textDecoration: 'none' } as const;
