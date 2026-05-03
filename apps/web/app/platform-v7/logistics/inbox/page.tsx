export default function LogisticsInboxPage() {
  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 22, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Логистика · входящие заявки · симуляция</p>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,4.6vw,50px)', lineHeight: 1.04, letterSpacing: '-0.045em' }}>Заявка появляется после выбора победителя</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>Логистическая компания принимает заказ по сделке, выбирает ближайшего доступного водителя и создаёт рейс. Это simulation-grade контур, без live GPS и без внешнего API.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <article style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, color: '#64748B', fontSize: 12, fontWeight: 900 }}>Заявка</p>
          <h2 style={{ margin: 0, color: '#0F1419' }}>LOG-REQ-2403</h2>
          <p style={{ margin: 0, color: '#475569' }}>LOT-2403 → DL-9106</p>
          <p style={{ margin: 0, color: '#475569' }}>Пшеница 3 кл. · 500 т</p>
          <p style={{ margin: 0, color: '#475569' }}>Склад продавца → Элеватор ВРЖ-08</p>
        </article>

        <article style={{ background: '#0F1419', color: '#fff', borderRadius: 22, padding: 18, display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, color: '#B6C2CF', fontSize: 12, fontWeight: 900 }}>Назначение</p>
          <h2 style={{ margin: 0 }}>Ближайший водитель выбран</h2>
          <p style={{ margin: 0, color: '#D8DEE6' }}>Расстояние 12 км · прибытие через 18 минут</p>
          <p style={{ margin: 0, color: '#D8DEE6' }}>Создан рейс TRIP-SIM-001</p>
          <a href="/platform-v7/driver" style={{ color: '#fff', textDecoration: 'none', borderRadius: 14, background: '#0A7A5F', padding: '12px 14px', textAlign: 'center', fontWeight: 900 }}>Открыть кабинет водителя</a>
        </article>
      </section>
    </main>
  );
}
