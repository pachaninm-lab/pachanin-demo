import Link from 'next/link';

const stages = [
  {
    title: '1. Партия и лот',
    note: 'Товар появляется из подтверждённой партии, затем превращается в черновик лота.',
    links: [
      { label: 'ФГИС → лот', href: '/platform-v7/fgis-to-lot' },
      { label: 'Рынок и заявки', href: '/platform-v7/market-rfq' },
    ],
  },
  {
    title: '2. Торги и ставки',
    note: 'Покупатель видит проверяемый лот, продавец видит обезличенные ставки и условия исполнения.',
    links: [
      { label: 'Торги и ставки', href: '/platform-v7/trading' },
      { label: 'Лот глазами покупателя', href: '/platform-v7/buyer-lot' },
      { label: 'Ставки по лотам', href: '/platform-v7/seller/offers' },
      { label: 'Журнал торгов', href: '/platform-v7/offer-log' },
    ],
  },
  {
    title: '3. Черновик сделки',
    note: 'Принятая ставка не запускает деньги сразу: сначала создаётся черновик сделки и проверяются условия.',
    links: [
      { label: 'Ставка → черновик сделки', href: '/platform-v7/offer-to-deal' },
      { label: 'Антиобход', href: '/platform-v7/anti-bypass' },
    ],
  },
  {
    title: '4. Допуск к исполнению',
    note: 'Перед исполнением проверяются партия, документы, логистика, деньги, спор и риск обхода.',
    links: [
      { label: 'Готовность сделки', href: '/platform-v7/readiness' },
      { label: 'Проверка выпуска денег', href: '/platform-v7/bank/release-safety' },
    ],
  },
  {
    title: '5. Исполнение',
    note: 'Логистика, перевозочные документы, приёмка и банковый контур ведутся как дочерние части сделки.',
    links: [
      { label: 'Логистика', href: '/platform-v7/logistics' },
      { label: 'Банк', href: '/platform-v7/bank' },
      { label: 'Споры', href: '/platform-v7/disputes' },
      { label: 'Пакет проверки', href: '/platform-v7/data-room' },
    ],
  },
];

const principles = [
  'Новые экраны не должны жить отдельно от сделки.',
  'Ставка превращается в сделку только после проверки допуска.',
  'Деньги нельзя выпускать без документов, логистики, банка и отсутствия открытого спора.',
  'Покупатели до черновика сделки остаются обезличенными.',
  'Все спорные события должны оставаться в журнале и пакете доказательств.',
];

const shell: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  color: '#0f172a',
  padding: '32px',
};

const wrap: React.CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  display: 'grid',
  gap: '20px',
};

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '22px',
  padding: '22px',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
};

const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  padding: '9px 13px',
  color: '#0f172a',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 700,
  background: '#f8fafc',
};

export default function PlatformV7ExecutionMapPage() {
  return (
    <main style={shell}>
      <div style={wrap}>
        <section style={card}>
          <p style={{ margin: '0 0 10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Проверочный контур · песочница
          </p>
          <h1 style={{ margin: 0, fontSize: '34px', lineHeight: 1.1 }}>Карта исполнения сделки</h1>
          <p style={{ margin: '14px 0 0', maxWidth: '820px', color: '#475569', fontSize: '16px', lineHeight: 1.7 }}>
            Один маршрут связывает товар из ФГИС, лот, ставки, черновик сделки, готовность, логистику,
            документы, деньги, спор и доказательства. Экран не запускает действия и не заявляет боевые интеграции:
            он показывает, где находится каждый рабочий контур.
          </p>
        </section>

        <section style={grid}>
          {stages.map((stage) => (
            <article key={stage.title} style={card}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{stage.title}</h2>
              <p style={{ margin: '10px 0 18px', color: '#475569', lineHeight: 1.6 }}>{stage.note}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {stage.links.map((item) => (
                  <Link key={item.href} href={item.href} style={linkStyle}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section style={card}>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Правила связности</h2>
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {principles.map((item) => (
              <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: '#334155' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f766e', marginTop: '8px', flex: '0 0 auto' }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
