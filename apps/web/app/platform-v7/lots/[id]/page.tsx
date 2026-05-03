interface LotPageProps {
  params: { id: string };
}

const bids = [
  { buyer: 'Покупатель 1', price: '15 240 ₽/т', state: 'Победитель' },
  { buyer: 'Покупатель 2', price: '15 120 ₽/т', state: 'Перебит' },
  { buyer: 'Покупатель 3', price: '14 980 ₽/т', state: 'Отклонён по условиям' },
];

export default function LotPage({ params }: LotPageProps) {
  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 22, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Торги · симуляция</p>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,4.6vw,50px)', lineHeight: 1.04, letterSpacing: '-0.045em' }}>Лот {params.id}: победитель выбран</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>После выбора победителя создаётся сделка DL-9106, а заявка автоматически попадает в логистическую компанию.</p>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        {bids.map((bid) => (
          <article key={bid.buyer} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 15, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ color: '#0F1419' }}>{bid.buyer}</strong>
            <span style={{ color: '#0F1419', fontWeight: 900 }}>{bid.price}</span>
            <span style={{ color: bid.state === 'Победитель' ? '#0A7A5F' : '#64748B', fontWeight: 900 }}>{bid.state}</span>
          </article>
        ))}
      </section>

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/platform-v7/deals/DL-9106/clean" style={{ color: '#fff', background: '#0F1419', borderRadius: 14, padding: '12px 14px', textDecoration: 'none', fontWeight: 900 }}>Открыть сделку</a>
        <a href="/platform-v7/logistics/inbox" style={{ color: '#fff', background: '#0A7A5F', borderRadius: 14, padding: '12px 14px', textDecoration: 'none', fontWeight: 900 }}>Заявка в логистике</a>
      </section>
    </main>
  );
}
