'use client';

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type SupportStatus = 'platform' | 'planned' | 'integration';

const STATUS_CFG: Record<SupportStatus, { label: string; bg: string; color: string; icon: string }> = {
  platform: { label: 'Платформа', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'Доработка', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  integration: { label: 'Интеграция позже', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const SUPPORT_READINESS: Array<{ title: string; status: SupportStatus; description: string; acceptance: string }> = [
  {
    title: 'Обращение связано со сделкой',
    status: 'platform',
    description: 'Support не должен быть отдельным чатом ради чата: обращение должно помогать исполнению сделки.',
    acceptance: 'в обращении должна быть ссылка на сделку, роль, проблему и следующий шаг',
  },
  {
    title: 'Очередь операторов',
    status: 'planned',
    description: 'Нужна рабочая очередь без статичных фиктивных тикетов, имён сотрудников и дат.',
    acceptance: 'список должен строиться из фактических обращений активного контура',
  },
  {
    title: 'Эскалация проблемы',
    status: 'planned',
    description: 'Критичные проблемы должны переводиться в ответственный контур без потери истории.',
    acceptance: 'каждое действие оператора должно иметь журнал и владельца',
  },
  {
    title: 'Внешние каналы',
    status: 'integration',
    description: 'Почта, CRM, телефония и мессенджеры подключаются только после отдельной приёмки.',
    acceptance: 'внешний канал не считается подключённым без подтверждённого процесса',
  },
];

export function SupportOpsPanel() {
  const platform = SUPPORT_READINESS.filter((item) => item.status === 'platform').length;
  const planned = SUPPORT_READINESS.filter((item) => item.status === 'planned').length;
  const integration = SUPPORT_READINESS.filter((item) => item.status === 'integration').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: SUPPORT_READINESS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Интеграции', value: integration, color: integration > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        Support Ops: настоящая платформа временно без интеграций. Статичные тикеты, имена сотрудников, SLA и история действий не показываются без фактической очереди обращений.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {SUPPORT_READINESS.map((item) => {
          const cfg = STATUS_CFG[item.status];
          return (
            <div key={item.title} style={{ borderRadius: 12, border: '1px solid #E4E6EA', background: item.status === 'integration' ? '#FFFBEB' : '#F8FAFB', padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.description}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>Acceptance: {item.acceptance}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Support Ops readiness · обращения должны усиливать исполнение сделки, а не подменять продуктовый контур.
      </div>
    </div>
  );
}
