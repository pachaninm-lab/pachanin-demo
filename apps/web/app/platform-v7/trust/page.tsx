import Link from 'next/link';

const rows = [
  ['Подтверждено', 'роли, сделки, деньги, документы, споры, логистика, проверки формулировок'],
  ['Тестовый сценарий', 'банковские события, отклонения, отчёты и демо-путь сделки'],
  ['Требует внешних доступов', 'банк, ФГИС, ЭДО, СДИЗ, телематика, КЭП и реальные сделки'],
  ['Не обещается', 'боевой контур, полный автоматический выпуск денег и закрытие всех рисков'],
] as const;

export default function PlatformV7TrustPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 }}>Центр доверия</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Карта зрелости платформы</h1>
        <p style={{ margin: 0, maxWidth: 880, fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>Экран отделяет подтверждённый предпилотный контур от тестовых сценариев и внешних подключений, которые требуют договоров, доступов и проверки на реальных сделках.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/bank/events" style={primaryLink}>События банка</Link>
          <Link href="/platform-v7/simulator" style={secondaryLink}>Симулятор</Link>
          <Link href="/platform-v7/reports" style={secondaryLink}>Отчёты</Link>
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {rows.map(([title, text]) => (
          <article key={title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#0F1419' }}>{title}</h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#475569' }}>{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

const primaryLink = { display: 'inline-flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondaryLink = { ...primaryLink, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
