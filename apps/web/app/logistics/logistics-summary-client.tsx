'use client';

interface Props { total: number; inTransit: number; critical: number; completed: number; }

export function LogisticsSummaryClient({ total, inTransit, critical, completed }: Props) {
  const items = [
    { label: 'Всего', value: total, color: '#111827' },
    { label: 'В пути', value: inTransit, color: '#2563EB' },
    { label: 'Critical', value: critical, color: '#DC2626' },
    { label: 'Completed', value: completed, color: '#22C55E' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <div key={item.label} className="soft-box subtle" style={{ textAlign: 'center' }}>
          <div className="muted tiny">{item.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: item.color, marginTop: 8 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
