import type { BypassSignal } from '../../lib/platform-v7/bypass-risk-score';

export function OperatorBypassQueue({ signals }: { signals: BypassSignal[] }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {signals.map((signal) => (
        <article key={signal.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: '#0F1419', fontSize: 14 }}>{signal.signalType}</strong>
            <span style={{ color: signal.riskLevel === 'critical' || signal.riskLevel === 'high' ? '#B91C1C' : '#B45309', fontSize: 12, fontWeight: 900 }}>{signal.riskLevel}</span>
          </div>
          <span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>{signal.description}</span>
          <span style={{ color: '#0F1419', fontSize: 12, fontWeight: 900 }}>Объект: {signal.dealId ?? signal.lotId ?? signal.rfqId ?? 'без сделки'} · роль: {signal.actorRole}</span>
        </article>
      ))}
    </div>
  );
}
