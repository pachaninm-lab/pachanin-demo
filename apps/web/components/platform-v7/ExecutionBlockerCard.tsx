type Props = {
  reason: string;
  actor?: string;
  dealId?: string;
};

export function ExecutionBlockerCard({ reason, actor, dealId }: Props) {
  return (
    <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#B91C1C', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {dealId ? `${dealId} · блокер` : 'Блокер'}
        </span>
        {actor && (
          <span style={{ color: '#B45309', fontSize: 11, fontWeight: 900, background: 'rgba(180,83,9,0.07)', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 999, padding: '3px 8px' }}>
            {actor}
          </span>
        )}
      </div>
      <p style={{ margin: 0, color: '#0F1419', fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>{reason}</p>
    </div>
  );
}
