import Link from 'next/link';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldElevatorRuntime } from '@/components/v7r/FieldElevatorRuntime';

const acceptanceSteps = [
  { label: 'Вес', value: 'расхождение фиксируется', href: '/platform-v7/elevator' },
  { label: 'Качество', value: 'лаборатория и допуск', href: '/platform-v7/lab' },
  { label: 'Документы', value: 'основание выплаты', href: '/platform-v7/documents' },
  { label: 'Деньги', value: 'выпуск или удержание', href: '/platform-v7/bank/clean' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Приёмка как доказательство сделки
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
              Вес и качество должны сразу влиять на документы и деньги
            </h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
              Приёмка нужна не как отдельный журнал. Она должна показать, принят ли груз, есть ли отклонение, какие доказательства собраны и можно ли выпускать деньги.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/deals/DL-9102/clean' style={primary}>Сделка DL-9102</Link>
            <Link href='/platform-v7/bank/release-safety' style={secondary}>Проверка выплаты</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {acceptanceSteps.map((item) => (
            <Link key={item.label} href={item.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      <RoleExecutionSummary role="elevator" />
      <FieldElevatorRuntime />
    </div>
  );
}

const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
