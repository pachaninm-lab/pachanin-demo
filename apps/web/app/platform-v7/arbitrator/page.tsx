import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import ArbitratorPage from '@/app/platform-v7r/arbitrator/page';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="arbitrator" />
      <section data-testid="platform-v7-arbitrator-decision-guard" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Арбитр · рамка решения</div>
        <div style={{ fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Решение арбитра создаёт основание для проверки</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
          Арбитр фиксирует сумму спора, доказательства, причину остановки и рекомендуемое действие. Следующий шаг требует ручной сверки основания.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {[
            ['Сумма спора', 'решение должно иметь сумму и основание'],
            ['Доказательства', 'акт, протокол, вес, фото и журнал должны быть видимы'],
            ['Следующий шаг', 'оператор передаёт основание на проверку'],
            ['Журнал', 'решение и причина фиксируются в истории сделки'],
          ].map(([title, text]) => (
            <div key={title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{title}</div>
              <div style={{ marginTop: 5, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>{text}</div>
            </div>
          ))}
        </div>
      </section>
      <JournalPreview role="arbitrator" />
      <ArbitratorPage />
    </div>
  );
}
