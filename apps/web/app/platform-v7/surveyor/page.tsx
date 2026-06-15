import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { BatonStrip } from '@/components/platform-v7/BatonStrip';
import { CockpitHero } from '@/components/platform-v7/premium';

const surveyorSteps = [
  { label: 'Осмотр', value: 'фото и состояние', note: 'что видно на площадке без пересказа сторон' },
  { label: 'Расхождение', value: 'причина и место', note: 'где возникло отклонение и чем подтверждается' },
  { label: 'Замечание', value: 'текст и вложения', note: 'кратко, с привязкой к рейсу и партии' },
  { label: 'Заключение', value: 'независимая фиксация', note: 'основание уходит в доказательный контур' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <CockpitHero
        eyebrow='Независимая фиксация на площадке'
        title='Осмотр, фото, расхождение и заключение'
        lead='Роль сюрвейера показывает только независимую проверку: фото, состояние груза, расхождения, замечания по приёмке и заключение для доказательного контура. Деньги, банк и решение спора остаются вне этой роли.'
      >
        <div style={stepsGrid}>
          {surveyorSteps.map((item) => (
            <div key={item.label} style={stepCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 15, lineHeight: 1.35 }}>{item.value}</strong>
              <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </CockpitHero>

      <BatonStrip
        from="логистика — рейс и груз"
        mine="осмотр, фото, расхождение, акт"
        to="оператор — доказательный контур"
        toHref="/platform-v7/disputes"
      />
      <RoleExecutionSummary role="surveyor" />

      <section style={{ background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 18, display: 'grid', gap: 12 }}>
        <div style={micro}>Назначения</div>
        {ASSIGNMENTS.map((a) => (
          <a key={a.id} href={`/platform-v7/surveyor/acts/${a.id}`} style={assignmentCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{a.id}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--pc-text-primary, #0F1419)', fontWeight: 700 }}>{a.cargo} · {a.location}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--pc-text-muted, #64748B)' }}>{a.deal} · {a.time}</div>
              </div>
              <span style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(217,119,6,0.24)', background: 'rgba(217,119,6,0.07)', color: '#B45309', fontSize: 11, fontWeight: 900 }}>{a.status}</span>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}

const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 } as const;
const stepCard = {
  background: 'var(--pc-bg-card)',
  border: '1px solid var(--pc-border, #E4E6EA)',
  borderRadius: 18,
  padding: 14,
  display: 'grid',
  gap: 7,
  boxShadow: '0 12px 28px rgba(15,23,42,0.055)',
} as const;
const micro = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const assignmentCard = { textDecoration: 'none', color: 'inherit', background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'block' } as const;

const ASSIGNMENTS = [
  { id: 'QC-DL-9102', deal: 'DL-9102', cargo: 'Пшеница 4 кл.', location: 'Элеватор Тамбов', time: '11:00', status: 'Требует акта' },
  { id: 'QC-DL-9108', deal: 'DL-9108', cargo: 'Ячмень 3 кл.', location: 'Склад Курск', time: '14:30', status: 'Ожидает' },
];
