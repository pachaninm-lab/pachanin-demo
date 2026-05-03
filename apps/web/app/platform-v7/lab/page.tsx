import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

const labSteps = [
  { label: 'Проба', value: 'отбор и фиксация' },
  { label: 'Показатели', value: 'влага, сорность, клейковина' },
  { label: 'Отклонение', value: 'причина и комментарий' },
  { label: 'Результат', value: 'допуск или не допущено' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
            Лаборатория как доказательство качества
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
            Лаборатория фиксирует показатели без доступа к деньгам и спорам
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
            Лабораторный экран должен показывать только пробу, показатели качества, отклонения и итоговый допуск. Финансовое решение остаётся вне роли лаборатории.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {labSteps.map((item) => (
            <div key={item.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <RoleExecutionSummary role="lab" />
      <RoleContinuityPanel role="lab" compact />
      <FieldLabRuntime />
    </div>
  );
}
