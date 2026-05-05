import Link from 'next/link';

const checks = [
  ['Роли', 'закрыты', '/platform-v7/executive/grain'],
  ['Деньги', 'под контролем', '/platform-v7/settlement/grain'],
  ['Документы', 'на проверке', '/platform-v7/documents/grain'],
  ['Интеграции', 'синхронизированы', '/platform-v7/integrations/grain'],
  ['Риски', 'отслеживаются', '/platform-v7/security/grain'],
  ['Демо-показ', 'готов', '/platform-v7/reports/grain'],
] as const;

export default function GrainReadinessPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Готовность зернового контура</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Роли, деньги, документы, интеграции, риски и демо-показ</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Финальная сводка показывает, какие блоки готовы к демонстрации и куда перейти для проверки каждого контура.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/readiness' style={btn}>Readiness</Link>
          <Link href='/platform-v7/executive/grain' style={ghost}>Executive</Link>
          <Link href='/platform-v7/reports/grain' style={ghost}>Отчёт</Link>
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
        {checks.map(([title, value, href], index) => <Link key={title} href={href} style={card}><b>{index + 1}. {title}</b><span style={{ color: '#0A7A5F', fontWeight: 900 }}>{value}</span><span style={{ color: '#64748B' }}>Открыть</span></Link>)}
      </section>
    </main>
  );
}

const btn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghost = { ...btn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
const card = { textDecoration: 'none', minHeight: 150, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
