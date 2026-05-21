const SYSTEMS = [
  { title: 'Банк', status: 'Ожидается ответ', note: 'Показан тестовый ответ вместо боевого банковского подключения.', next: 'Оператор должен открыть проверку выпуска денег.' },
  { title: 'ФГИС Зерно', status: 'Ответ получен', note: 'Показана симуляция проверки партии.', next: 'Проверить лот и документы.' },
  { title: 'ЭДО', status: 'Ручная проверка', note: 'Показана симуляция статуса подписей.', next: 'Дособрать подписи или отправить на ручную проверку.' },
  { title: 'ЭТрН', status: 'Ожидается ответ', note: 'Показана симуляция транспортного пакета.', next: 'Проверить рейс и транспортные документы.' },
  { title: 'GPS / телематика', status: 'Ожидается ответ', note: 'Показана симуляция координат рейса.', next: 'Сверить маршрут и статус рейса.' },
  { title: 'Лаборатория', status: 'Ответ получен', note: 'Показана симуляция протокола качества.', next: 'Проверить качество и спорные отклонения.' },
] as const;

function tone(status: string) {
  if (status === 'Ответ получен') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (status === 'Ручная проверка') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' };
}

export function TestModeSystemsPanel() {
  return (
    <section data-testid="platform-v7-test-mode-systems" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Внешние подключения · тестовый режим</div>
        <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Симуляция ответов</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Боевые подключения здесь не используются. Экран показывает тестовые ответы и следующий шаг по сделке.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {SYSTEMS.map((item) => {
          const t = tone(item.status);
          return (
            <div key={item.title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{item.title}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 7px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{item.status}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>{item.note}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 750 }}>Следующий шаг: {item.next}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
