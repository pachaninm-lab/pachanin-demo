import Link from 'next/link';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import SurveyorPage from '@/app/platform-v7r/surveyor/page';

const surveyorSteps = [
  { label: 'Осмотр', value: 'фото и состояние', href: '/platform-v7/surveyor' },
  { label: 'Расхождение', value: 'фиксировать причину', href: '/platform-v7/disputes/DK-2024-89' },
  { label: 'Приёмка', value: 'вес и качество', href: '/platform-v7/elevator' },
  { label: 'Доказательства', value: 'для решения спора', href: '/platform-v7/documents' },
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Независимая фиксация на площадке
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
              Сюрвейер фиксирует расхождения как доказательства для спора и выплаты
            </h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
              Роль сюрвейера должна показывать только независимую проверку: фото, состояние груза, расхождения, замечания по приёмке и доказательства для решения спора.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/elevator' style={primary}>Приёмка</Link>
            <Link href='/platform-v7/disputes/DK-2024-89' style={secondary}>Спор</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {surveyorSteps.map((item) => (
            <Link key={item.label} href={item.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      <RoleExecutionSummary role="surveyor" />
      <SurveyorPage />
    </div>
  );
}

const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
