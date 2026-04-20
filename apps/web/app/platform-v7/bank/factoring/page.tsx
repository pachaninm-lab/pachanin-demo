export default function BankFactoringPage() {
  const cards = [
    { title: 'Доступный лимит', value: '48 млн ₽', note: 'Сводный лимит по одобренным покупателям' },
    { title: 'Ставка', value: 'КС + 4.2%', note: 'Базовая модель для пилотного контура' },
    { title: 'Активные заявки', value: '6', note: '3 на проверке, 2 одобрены, 1 требует документов' },
    { title: 'Выплаченные авансы', value: '19.4 млн ₽', note: 'С начала месяца по профинансированным сделкам' }
  ];

  const applications = [
    { id: 'FAC-201', buyer: 'МаслоПресс ООО', deal: 'DL-9108', amount: '8.6 млн ₽', status: 'Одобрено', next: 'Подтвердить выпуск аванса' },
    { id: 'FAC-202', buyer: 'Агрохолдинг СК', deal: 'DL-9110', amount: '12.1 млн ₽', status: 'Проверка', next: 'Дождаться финального скоринга' },
    { id: 'FAC-203', buyer: 'Зерно Трейд', deal: 'DL-9114', amount: '5.4 млн ₽', status: 'Документы', next: 'Загрузить пакет уступки требований' }
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Факторинг</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Контур финансирования покупателя: лимиты, ставка, заявки на факторинг и выплаченные авансы по сделкам платформы.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 800 }}>
            Пилотный банковый модуль
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {cards.map((card) => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{card.title}</div>
            <div style={{ fontSize: 30, lineHeight: 1.05, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{card.note}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Заявки на факторинг</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {applications.map((item) => (
            <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F1419' }}>{item.id}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F5F7F8', border: '1px solid #E4E6EA', fontSize: 11, fontWeight: 800, color: '#475569' }}>{item.status}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>{item.buyer} · {item.deal}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>Сумма заявки: {item.amount}</div>
              <div style={{ fontSize: 12, color: '#6B778C' }}>Следующий шаг: {item.next}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
