'use client';

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

const ITEMS = [
  { title: 'Связь со сделкой', status: 'Платформа', text: 'Аналитика должна строиться от событий сделки и помогать видеть следующий шаг.', color: '#065F46', bg: '#D1FAE5' },
  { title: 'Единые события', status: 'Доработка', text: 'Нужны единые события по лоту, рейсу, приёмке, документам и спору.', color: '#1E40AF', bg: '#DBEAFE' },
  { title: 'Отчётные витрины', status: 'Доработка', text: 'Показатели отображаются только после наполнения рабочими событиями.', color: '#1E40AF', bg: '#DBEAFE' },
  { title: 'Внешние источники', status: 'Интеграция позже', text: 'Внешние источники временно не подключены.', color: '#92400E', bg: '#FEF3C7' },
];

export function ClickHouseAnalyticsPanel() {
  const platform = ITEMS.filter((item) => item.status === 'Платформа').length;
  const planned = ITEMS.filter((item) => item.status === 'Доработка').length;
  const integrations = ITEMS.filter((item) => item.status === 'Интеграция позже').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: ITEMS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Интеграции', value: integrations, color: integrations > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.6 }}>
        Аналитика: настоящая платформа временно без интеграций. Статичные графики и числовые показатели не используются как подтверждение работы внешних источников.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ITEMS.map((item) => (
          <div key={item.title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: item.bg, color: item.color }}>{item.status}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.text}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Аналитика должна усиливать исполнение сделки; внешние интеграции временно не подключены.
      </div>
    </div>
  );
}
