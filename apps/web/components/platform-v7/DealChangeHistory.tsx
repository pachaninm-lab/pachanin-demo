'use client';

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

const ITEMS = [
  { title: 'История вокруг сделки', status: 'Платформа', text: 'Журнал должен фиксировать изменения по сделке, участникам, документам, логистике, качеству, деньгам и спору.', color: '#065F46', bg: '#D1FAE5' },
  { title: 'Источник события', status: 'Доработка', text: 'Каждое событие должно иметь источник, автора, время, основание и связь с объектом сделки.', color: '#1E40AF', bg: '#DBEAFE' },
  { title: 'Неизменяемость', status: 'Доработка', text: 'Изменения должны попадать в журнал без возможности тихой правки задним числом.', color: '#1E40AF', bg: '#DBEAFE' },
  { title: 'Фильтры и роли', status: 'Доработка', text: 'Просмотр истории должен учитывать серверный доступ участника и не раскрываться через клиентский фильтр.', color: '#1E40AF', bg: '#DBEAFE' },
];

interface Props {
  dealId?: string;
  compact?: boolean;
}

export function DealChangeHistory({ dealId: _dealId, compact = false }: Props) {
  const platform = ITEMS.filter((item) => item.status === 'Платформа').length;
  const planned = ITEMS.filter((item) => item.status === 'Доработка').length;

  return (
    <div style={{ display: 'grid', gap: compact ? '0.625rem' : '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: ITEMS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        История изменений: настоящая платформа временно без интеграций. Статичные события, суммы, участники и действия не показываются как реальный журнал сделки.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ITEMS.map((item) => (
          <div key={item.title} style={{ padding: compact ? '9px 11px' : '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: item.bg, color: item.color }}>{item.status}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
            </div>
            {!compact && <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.text}</div>}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Журнал изменений должен усиливать доказательность сделки; внешние интеграции временно не подключены.
      </div>
    </div>
  );
}
