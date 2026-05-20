import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';

const labSteps = [
  { label: 'Проба', value: 'отбор и фиксация', note: 'кто взял, когда, по какому рейсу' },
  { label: 'Показатели', value: 'влага, сорность, клейковина', note: 'цифры должны быть видны без спора о словах' },
  { label: 'Отклонение', value: 'причина и комментарий', note: 'что не прошло допуск и почему' },
  { label: 'Протокол', value: 'допуск или не допущено', note: 'основание уходит в контур документов' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <QuietIntelligenceHint
        problem='Сорная примесь 2,4% превышает допуск 2% — протокол качества не закрыт.'
        action='Зафиксировать показатели и выдать протокол с допуском или отказом.'
        outcome='Протокол уйдёт в контур документов как основание для банковской проверки.'
      />
      <section style={hero}>
        <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
          <div style={badge}>
            Лаборатория как доказательство качества
          </div>
          <h1 style={h1}>
            Проба, показатели и протокол качества
          </h1>
          <p style={lead}>
            Лабораторный экран показывает только пробу, показатели качества, отклонения и итоговый допуск. Финансовое решение, спор и банковская проверка остаются вне роли лаборатории.
          </p>
        </div>

        <div style={stepsGrid}>
          {labSteps.map((item) => (
            <div key={item.label} style={stepCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.35 }}>{item.value}</strong>
              <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </section>

      <CauseLine
        cause={{ text: 'Протокол качества не выдан', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Расчёт и банковская проверка заблокированы', tone: 'blocked' }}
        moneyAmount='9,65 млн ₽'
        moneyTone='hold'
      />
      <TrustDot state='test' size='sm' label='Тестовый контур · ФГБУ ЦОК АПК требует договора' />

      <RoleExecutionSummary role="lab" />
      <RoleContinuityPanel role="lab" compact />
      <FieldLabRuntime />
    </div>
  );
}

const hero = {
  background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 58%, #EEF6F3 100%)',
  border: '1px solid #E4E6EA',
  borderRadius: 28,
  padding: 24,
  display: 'grid',
  gap: 16,
  boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
} as const;
const badge = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '7px 11px',
  borderRadius: 999,
  background: 'rgba(10,122,95,0.08)',
  border: '1px solid rgba(10,122,95,0.18)',
  color: '#0A7A5F',
  fontSize: 12,
  fontWeight: 900,
} as const;
const h1 = {
  margin: 0,
  fontSize: 'clamp(30px, 4.8vw, 52px)',
  lineHeight: 1.04,
  letterSpacing: '-0.045em',
  color: '#0F1419',
  fontWeight: 950,
} as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 } as const;
const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 } as const;
const stepCard = {
  background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)',
  border: '1px solid #E4E6EA',
  borderRadius: 18,
  padding: 14,
  display: 'grid',
  gap: 7,
  boxShadow: '0 12px 28px rgba(15,23,42,0.055)',
} as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
