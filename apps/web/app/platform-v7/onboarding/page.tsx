const steps = [
  {
    title: '1. Компания',
    fields: ['ИНН / ОГРН', 'Полное наименование', 'Регион', 'Контактное лицо'],
    note: 'Базовый профиль компании и первичная идентификация.',
  },
  {
    title: '2. Роль',
    fields: ['Продавец', 'Покупатель', 'Логистика', 'Лаборатория', 'Банк / финпартнёр'],
    note: 'Выбор основного рабочего контура и прав доступа.',
  },
  {
    title: '3. Реквизиты',
    fields: ['Расчётный счёт', 'Банк', 'БИК', 'Подписант'],
    note: 'Данные для расчётов, удержаний и будущих выплат.',
  },
  {
    title: '4. Документы',
    fields: ['Устав / ЕГРЮЛ', 'Доверенности', 'Сертификаты', 'Данные по культурам'],
    note: 'Загрузка обязательного пакета для допуска и сделок.',
  },
  {
    title: '5. Банк',
    fields: ['Подключение СберБизнес ID', 'Режим безопасной сделки', 'Эскроу / факторинг'],
    note: 'Финансовый контур и правила выпуска денег.',
  },
  {
    title: '6. Первый лот',
    fields: ['Культура', 'Объём', 'Цена', 'Базис поставки'],
    note: 'Стартовая карточка сделки или торгового предложения.',
  },
];

export default function OnboardingPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Онбординг компании</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Пошаговый вход в платформу: компания, роль, реквизиты, документы, банковый контур и первый лот. Контур сделан как демо-мастер, чтобы показать целевую механику pilot-ready запуска.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
            6 шагов подключения
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        {steps.map((step) => (
          <div key={step.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{step.title}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {step.fields.map((field) => (
                <span key={field} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 700 }}>{field}</span>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>{step.note}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
