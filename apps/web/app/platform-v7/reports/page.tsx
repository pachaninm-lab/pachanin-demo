import Link from 'next/link';

const rows = ['Сводка сделки', 'Пакет доказательств', 'Журнал действий', 'События банка', 'Отчёт пилота'] as const;

export default function PlatformV7ReportsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 }}>Отчёты · тестовый сценарий</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Центр отчётов</h1>
        <p style={{ margin: 0, maxWidth: 840, fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>Артефакты для банка, пилота, спора и операционного разбора. Материалы не подменяют внешние юридически значимые документы.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/trust" style={primaryLink}>Центр доверия</Link>
          <Link href="/platform-v7/bank/events" style={secondaryLink}>События банка</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        {rows.map((name) => (
          <article key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #EEF1F4' }}>
            <strong style={{ fontSize: 14, color: '#0F1419' }}>{name}</strong>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 900 }}>Подготовка</span>
          </article>
        ))}
      </section>
    </div>
  );
}

const primaryLink = { display: 'inline-flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondaryLink = { ...primaryLink, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
