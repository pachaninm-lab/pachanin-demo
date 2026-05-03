export default function LotPage({ params }: { params: { id: string } }) {
  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 22 }}>
        <p style={{ margin: 0, color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Торги · симуляция</p>
        <h1 style={{ margin: '8px 0 0', color: '#0F1419', fontSize: 'clamp(30px,4.6vw,50px)', lineHeight: 1.04 }}>Лот {params.id}: победитель выбран</h1>
        <p style={{ margin: '10px 0 0', color: '#475569', lineHeight: 1.7 }}>Победитель выбран. Создана сделка DL-9106, заявка LOG-REQ-2403 ушла в логистику, после назначения водителя появился рейс TRIP-SIM-001.</p>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        {['Покупатель 1 · победитель · 15 240', 'Покупатель 2 · перебит · 15 120', 'Покупатель 3 · отклонён'].map((item) => (
          <article key={item} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 15, color: '#0F1419', fontWeight: 900 }}>{item}</article>
        ))}
      </section>
      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/platform-v7/deals/DL-9106/clean">Открыть сделку</a>
        <a href="/platform-v7/logistics/inbox">Заявка в логистике</a>
      </section>
    </main>
  );
}
