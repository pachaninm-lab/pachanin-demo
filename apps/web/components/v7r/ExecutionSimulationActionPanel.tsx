'use client';

import { P7Badge } from '@/components/platform-v7/P7Badge';
import { P7Card } from '@/components/platform-v7/P7Card';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

const steps = [
  { id: 'lot', title: '1. Лот', note: 'Проверяется создание и публикация партии.' },
  { id: 'deal', title: '2. Сделка', note: 'Проверяется переход от партии к исполнению.' },
  { id: 'route', title: '3. Рейс', note: 'Проверяется назначение маршрута и роли водителя.' },
  { id: 'quality', title: '4. Качество', note: 'Проверяется лабораторный контур.' },
  { id: 'issue', title: '5. Разбор', note: 'Проверяется доказательный контур при отклонении.' },
];

export function ExecutionSimulationActionPanel() {
  return (
    <P7Card
      title="Проверочные действия сделки"
      subtitle="Компактная проверочная панель для Netlify-сборки. Расширенный интерактивный сценарий вернётся отдельным безопасным проходом после зелёного deploy."
      testId="execution-simulation-action-panel"
    >
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          <Metric label="Сценарий" value="5 шагов" />
          <Metric label="Статус" value="Предынтеграционный" />
          <Metric label="Роли" value="Закрыты" />
          <Metric label="Контур" value="Netlify" />
        </div>
        <section style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
          <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary }}>Сценарий проверки</strong>
          {steps.map((step) => (
            <div key={step.id} style={{ display: 'grid', gap: 4, padding: 12, borderRadius: 12, background: '#fff', border: `1px solid ${PLATFORM_V7_TOKENS.color.border}` }}>
              <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 14 }}>{step.title}</strong>
              <span style={{ color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 13 }}>{step.note}</span>
            </div>
          ))}
        </section>
        <P7Badge tone="info">Интерактивные команды временно отключены для стабилизации Netlify build.</P7Badge>
      </div>
    </P7Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 16, padding: 14, background: '#fff' }}>
      <div style={{ color: PLATFORM_V7_TOKENS.color.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}
