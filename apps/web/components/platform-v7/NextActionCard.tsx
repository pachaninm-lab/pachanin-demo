type Props = {
  action: string;
  reason?: string;
};

export function NextActionCard({ action, reason }: Props) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 14, padding: 14, display: 'grid', gap: 5 }}>
      <span style={{ color: '#475569', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Следующее действие</span>
      <p style={{ margin: 0, color: '#0F1419', fontSize: 14, fontWeight: 900 }}>{action}</p>
      {reason && <p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{reason}</p>}
    </div>
  );
}
