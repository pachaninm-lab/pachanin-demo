import { createPlatformV7ActionResult } from '@/lib/platform-v7/action-feedback';

const ACTIONS = [
  createPlatformV7ActionResult({
    actionId: 'check-documents',
    entityId: 'DL-9102',
    actor: 'Оператор',
    label: 'Проверить документы',
    testMode: true,
    nextStep: 'Открыть проверку выпуска денег.',
    timestamp: '2026-05-02T10:00:00.000Z',
  }),
  createPlatformV7ActionResult({
    actionId: 'request-manual-review',
    entityId: 'DL-9108',
    actor: 'Банк',
    label: 'Отправить на ручную проверку',
    stopReason: 'Не хватает транспортного пакета',
    nextStep: 'Запросить документ и указать основание.',
    timestamp: '2026-05-02T10:01:00.000Z',
  }),
  createPlatformV7ActionResult({
    actionId: 'close-dispute-check',
    entityId: 'DSP-2406',
    actor: 'Арбитр',
    label: 'Проверить доказательства',
    testMode: true,
    nextStep: 'Зафиксировать решение или запросить доказательство.',
    timestamp: '2026-05-02T10:02:00.000Z',
  }),
];

function statusTone(status: string) {
  if (status === 'success') return { label: 'Результат есть', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  return { label: 'Нужна проверка', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function P7ActionFeedbackStrip() {
  return (
    <section data-testid="platform-v7-action-feedback-strip" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action feedback · тестовый режим</div>
        <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Результат действия и следующий шаг</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Каждое действие должно показывать понятный результат, следующий шаг и запись для журнала. Ниже — единый контракт для старых и новых кнопок.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {ACTIONS.map((item) => {
          const tone = statusTone(item.feedback.status);
          return (
            <article key={item.feedback.actionId} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 900, color: '#0A7A5F' }}>{item.feedback.entityId}</div>
                  <div style={{ marginTop: 3, fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{item.feedback.actionId}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 7px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 900 }}>{tone.label}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>{item.feedback.message}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 750 }}>Следующий шаг: {item.nextStep}</div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: '#64748B' }}>Журнал: {item.journal.actor} · {item.journal.severity}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
