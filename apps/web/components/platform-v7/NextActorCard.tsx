type Props = {
  actor: string;
  action?: string;
};

export function NextActorCard({ actor, action }: Props) {
  return (
    <div style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.18)', borderRadius: 14, padding: 14, display: 'grid', gap: 5 }}>
      <span style={{ color: '#B45309', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Следующий исполнитель</span>
      <p style={{ margin: 0, color: '#0F1419', fontSize: 14, fontWeight: 900 }}>{actor}</p>
      {action && <p style={{ margin: 0, color: '#475569', fontSize: 12, lineHeight: 1.4 }}>{action}</p>}
    </div>
  );
}
