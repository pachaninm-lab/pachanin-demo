'use client';

type ItemStatus = 'platform' | 'planned' | 'integration';

const STATUS_CFG: Record<ItemStatus, { label: string; bg: string; color: string; icon: string }> = {
  platform: { label: 'Платформа', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'Доработка', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  integration: { label: 'Интеграция позже', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const ITEMS: Array<{ title: string; status: ItemStatus; text: string; acceptance: string }> = [
  {
    title: 'Ж/д перевозка связана со сделкой',
    status: 'platform',
    text: 'Железнодорожный сценарий должен быть продолжением сделки, а не отдельным трекером.',
    acceptance: 'в сделке видны тип перевозки, ответственный, документный статус и следующий шаг',
  },
  {
    title: 'Документы перевозки',
    status: 'planned',
    text: 'Электронные документы по перевозке должны быть связаны с приёмкой, весом, качеством и спором.',
    acceptance: 'нужен единый документный контур без разрыва между сделкой и перевозкой',
  },
  {
    title: 'Статусы вагонов',
    status: 'integration',
    text: 'Живой трекинг вагонов возможен только после внешнего подключения.',
    acceptance: 'без подключения не показывать номера вагонов, ETA, прогресс и маршрут как факт',
  },
  {
    title: 'Внешний контур РЖД',
    status: 'integration',
    text: 'Интеграция временно не подключена и требует договора, доступа, регламента и приёмки.',
    acceptance: 'подключение подтверждается только отдельным приёмочным отчётом',
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function EtranRzdPanel() {
  const platform = ITEMS.filter((item) => item.status === 'platform').length;
  const planned = ITEMS.filter((item) => item.status === 'planned').length;
  const integration = ITEMS.filter((item) => item.status === 'integration').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: ITEMS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Интеграции', value: integration, color: integration > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        РЖД/ЭТРАН readiness: настоящая платформа временно без интеграций. Номера вагонов, ETA, маршруты, прогресс и документы внешнего контура не показываются как подключённые.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ITEMS.map((item) => {
          const cfg = STATUS_CFG[item.status];
          return (
            <div key={item.title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: item.status === 'integration' ? '#FFFBEB' : '#F8FAFB' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.text}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>Acceptance: {item.acceptance}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Железнодорожный контур должен усиливать исполнение сделки; внешняя интеграция временно не подключена.
      </div>
    </div>
  );
}
