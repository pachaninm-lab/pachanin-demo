const DECISION_STEPS = [
  {
    title: 'Запросить доказательство',
    description: 'Запросить фото, вес, пломбу, протокол или документ у ответственной стороны.',
    result: 'История спора остаётся видимой. Отсутствующие geo/hash/version не подставляются искусственно.',
  },
  {
    title: 'Зафиксировать основание решения',
    description: 'Решение нельзя закрывать без причины и ссылки на доказательства.',
    result: 'Следующий шаг: указать, какая часть удержания остаётся или может быть направлена к выпуску.',
  },
  {
    title: 'Показать влияние на деньги',
    description: 'Решение должно объяснить, что происходит с удержанием и суммой под риском.',
    result: 'Денежное действие остаётся в банковском контуре и не заявляется как автоматический выпуск платформой.',
  },
];

export function EvidenceDecisionPanel() {
  return (
    <section data-testid="platform-v7-evidence-decision-panel" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Спор · решение по доказательствам</div>
        <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Решение требует основания и не скрывает историю</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Панель фиксирует безопасный порядок действий: запросить доказательства, указать основание, показать влияние на удержание. Недостающие технические метаданные не выдумываются.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {DECISION_STEPS.map((step) => (
          <article key={step.title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{step.title}</div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.45 }}>{step.description}</div>
            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.45, fontWeight: 750 }}>{step.result}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
