import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import SurveyorPage from '@/app/platform-v7r/surveyor/page';

const surveyorSteps = [
  { label: 'Осмотр', value: 'фото и состояние', note: 'что видно на площадке без пересказа сторон' },
  { label: 'Расхождение', value: 'причина и место', note: 'где возникло отклонение и чем подтверждается' },
  { label: 'Замечание', value: 'текст и вложения', note: 'кратко, с привязкой к рейсу и партии' },
  { label: 'Заключение', value: 'независимая фиксация', note: 'основание уходит в доказательный контур' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={hero}>
        <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
          <div style={badge}>
            Независимая фиксация на площадке
          </div>
          <h1 style={h1}>
            Осмотр, фото, расхождение и заключение
          </h1>
          <p style={lead}>
            Роль сюрвейера показывает только независимую проверку: фото, состояние груза, расхождения, замечания по приёмке и заключение для доказательного контура. Деньги, банк и решение спора остаются вне этой роли.
          </p>
        </div>

        <div style={stepsGrid}>
          {surveyorSteps.map((item) => (
            <div key={item.label} style={stepCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.35 }}>{item.value}</strong>
              <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </section>

      <RoleExecutionSummary role="surveyor" />
      <SurveyorPage />
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
