const ACTIONS = [
  {
    title: 'Запросить документ',
    description: 'Попросить ответственную сторону загрузить недостающий документ.',
    next: 'Следующий шаг: дождаться загрузки или отправить на ручную проверку.',
  },
  {
    title: 'Открыть проверку документов',
    description: 'Проверить, какой документ блокирует деньги или закрытие сделки.',
    next: 'Следующий шаг: подтвердить полноту пакета только после фактической сверки.',
  },
  {
    title: 'Отправить на ручную проверку',
    description: 'Зафиксировать причину, если внешний ответ или подпись отсутствуют.',
    next: 'Следующий шаг: оператор указывает основание и ждёт подтверждение внешней системы.',
  },
  {
    title: 'Повторить отправку в тестовом режиме',
    description: 'Смоделировать повторную отправку без заявления live-подключения.',
    next: 'Следующий шаг: показать результат как тестовый сценарий, не как боевой ответ.',
  },
];

export function DocumentsMatrixActions() {
  return (
    <section data-testid="platform-v7-documents-actions" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Документы · безопасные действия</div>
        <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Документный статус должен вести к следующему шагу</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Здесь нет фальшивых подписей или внешних подтверждений. Если данных нет, действие ведёт к запросу, проверке или ручному основанию.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {ACTIONS.map((action) => (
          <article key={action.title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{action.title}</div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.45 }}>{action.description}</div>
            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.45, fontWeight: 750 }}>{action.next}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
