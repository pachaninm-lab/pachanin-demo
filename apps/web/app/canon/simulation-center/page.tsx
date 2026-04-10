import Link from 'next/link';

const cases = [
  ['Опоздавшее банковое подтверждение', '/canon/finance/detail', 'Показывает, как деньги остаются на hold до подтверждения'],
  ['Неполный пакет документов', '/canon/documents/detail', 'Показывает, как document completeness блокирует переход'],
  ['Отклонение маршрута', '/canon/mobile2/detail', 'Показывает geofence, checkpoint и доказуемость маршрута'],
  ['Опоздание в слот приёмки', '/canon/receiving2/detail', 'Показывает risk queue и handoff в приёмку'],
  ['Повторный анализ качества', '/canon/quality/detail', 'Показывает retest и влияние на расчёт'],
  ['Открытие спора', '/canon/control/detail', 'Показывает owner, SLA и operator escalation'],
] as const;

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена · Simulation Center</div>
        <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.04, fontWeight: 900 }}>Центр симуляций и отклонений</h1>
        <p style={{ margin: '14px 0 22px', color: '#94a3b8', fontSize: 17, lineHeight: 1.6 }}>Здесь собраны управляемые исключения, которые делают платформу живой: деньги, документы, маршрут, приёмка, качество и спор.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {cases.map(([title, href, text]) => (
            <Link key={href + title} href={href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 26, padding: 18, display: 'block' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(34,197,94,.14)' }} />
              <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>{title}</div>
              <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
              <div style={{ marginTop: 14, color: '#22c55e', fontWeight: 800 }}>Открыть сценарий →</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
