type Props = {
  waitingFor: string;
  from: string;
  reason?: string;
};

export function WaitingForConfirmationCard({ waitingFor, from, reason }: Props) {
  return (
    <div style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 14, padding: 14, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#B45309', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ожидание подтверждения</span>
        <span style={{ color: '#B45309', fontSize: 11, fontWeight: 900, background: 'rgba(180,83,9,0.07)', border: '1px solid rgba(180,83,9,0.14)', borderRadius: 999, padding: '3px 8px' }}>
          от: {from}
        </span>
      </div>
      <p style={{ margin: 0, color: '#0F1419', fontSize: 13, fontWeight: 900 }}>{waitingFor}</p>
      {reason && <p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{reason}</p>}
    </div>
  );
}
