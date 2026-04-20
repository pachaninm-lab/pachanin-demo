export default function BankEscrowPage() {
  const metrics = [
    { title: 'Открыто эскроу', value: '11', note: 'Активные счета по сделкам в контуре' },
    { title: 'На удержании', value: '27.8 млн ₽', note: 'Сумма до наступления условий раскрытия' },
    { title: 'Условия раскрытия', value: '6', note: 'Типовые триггеры: приёмка, качество, документы, callback' },
    { title: 'История операций', value: '34', note: 'Записи по резервам, hold, release и возвратам' }
  ];

  const rows = [
    { id: 'ESC-301', deal: 'DL-9102', amount: '6.4 млн ₽', trigger: 'Финальный протокол качества', state: 'Удержание' },
    { id: 'ESC-302', deal: 'DL-9108', amount: '12.8 млн ₽', trigger: 'Приёмка + bank callback', state: 'Готово к раскрытию' },
    { id: 'ESC-303', deal: 'DL-9111', amount: '8.6 млн ₽', trigger: 'Закрытие спора', state: 'Ожидание решения' }
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Эскроу</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Резервирование денег до наступления подтверждённых условий раскрытия: приёмка, лаборатория, документы и callback банка.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
            Контур безопасной сделки
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {metrics.map((card) => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{card.title}</div>
            <div style={{ fontSize: 30, lineHeight: 1.05, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{card.note}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Активные эскроу-счета</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {rows.map((item) => (
            <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F1419' }}>{item.id}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F5F7F8', border: '1px solid #E4E6EA', fontSize: 11, fontWeight: 800, color: '#475569' }}>{item.state}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>{item.deal}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>Сумма: {item.amount}</div>
              <div style={{ fontSize: 12, color: '#6B778C' }}>Условие раскрытия: {item.trigger}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
