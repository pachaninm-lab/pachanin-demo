const steps = ['LOT-2403', 'ставка', 'победитель', 'DL-9106', 'LOG-REQ-2403', 'водитель', 'TRIP-SIM-001', 'маршрут', 'приёмка', 'деньги'] as const;

export default function DemoRunPage() {
  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#0F1419', color: '#fff', borderRadius: 26, padding: 24 }}>
        <p style={{ margin: 0, color: '#9FE3CC', fontSize: 12, fontWeight: 900 }}>Demo-run · simulation-grade</p>
        <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(30px,4.8vw,52px)', lineHeight: 1.04 }}>Цикл: торги → логистика → рейс → контроль</h1>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {steps.map((step, index) => (
          <article key={step} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 15 }}>
            <b>{index + 1}. {step}</b>
          </article>
        ))}
      </section>
      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/platform-v7/lots/LOT-2403">Лот</a>
        <a href="/platform-v7/logistics/inbox">Логистика</a>
        <a href="/platform-v7/driver">Водитель</a>
      </section>
    </main>
  );
}
