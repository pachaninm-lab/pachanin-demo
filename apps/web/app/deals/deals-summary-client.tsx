'use client';

interface Props { total: number; inTransit: number; disputes: number; settled: number; }

export function DealsSummaryClient({ total, inTransit, disputes, settled }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
      {[
        { label: 'Всего', value: total, color: '#0A5C36', icon: '📋' },
        { label: 'В пути', value: inTransit, color: '#2563EB', icon: '🚛' },
        { label: 'Споры', value: disputes, color: '#DC2626', icon: '⚖️' },
        { label: 'Завершено', value: settled, color: '#22C55E', icon: '✅' },
      ].map(s => (
        <div key={s.label} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>{s.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: '#666' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
