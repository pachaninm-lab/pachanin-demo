'use client';

const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

const ITEMS = [
  {
    title: 'Платформа',
    status: 'Платформа',
    text: 'Сделка, документы, роли и ключевые пользовательские действия остаются ядром эксплуатационных целей.',
    color: '#065F46',
    bg: '#D1FAE5',
  },
  {
    title: 'Мобильный контур',
    status: 'Доработка',
    text: 'Шапка, навигация, формы, роли и RU/EN/ZH должны проходить отдельную проверку на телефоне.',
    color: '#1E40AF',
    bg: '#DBEAFE',
  },
  {
    title: 'Отчёты качества',
    status: 'Доработка',
    text: 'Любые числовые показатели должны появляться только из сохранённых отчётов активного контура.',
    color: '#1E40AF',
    bg: '#DBEAFE',
  },
  {
    title: 'Внешние контуры',
    status: 'Интеграция позже',
    text: 'Банк, ЭДО, ФГИС, КЭП, ЕСИА, ERP и CRM временно не подключены и требуют отдельной приёмки.',
    color: '#92400E',
    bg: '#FEF3C7',
  },
];

export function SloSlaPanel() {
  const platform = ITEMS.filter((item) => item.status === 'Платформа').length;
  const planned = ITEMS.filter((item) => item.status === 'Доработка').length;
  const integrations = ITEMS.filter((item) => item.status === 'Интеграция позже').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[
          { title: 'Контуров', value: ITEMS.length, color: '#0F1419' },
          { title: 'Платформа', value: platform, color: '#065F46' },
          { title: 'Доработка', value: planned, color: '#1E40AF' },
          { title: 'Интеграции', value: integrations, color: integrations > 0 ? '#92400E' : '#065F46' },
        ].map((card) => (
          <div key={card.title} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{card.title}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        Эксплуатационные цели: настоящая платформа временно без интеграций. Исторические проценты, графики и инциденты не показываются без фактических отчётов.
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {ITEMS.map((item) => (
          <div key={item.title} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: item.bg, color: item.color }}>{item.status}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.text}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Эксплуатационные цели должны усиливать исполнение сделки и подтверждаться отчётами, а не статичными цифрами.
      </div>
    </div>
  );
}
